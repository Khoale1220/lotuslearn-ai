# ADR 006: Metadata Snapshot Integrity Contract and Deserialization Verification

## Status
Accepted

## Context
In milestone DE-04A, LotusLearn established canonical metadata graph extraction across PostgreSQL catalogs and dbt v1.12 compiler artifacts (`manifest.json`, `catalog.json`). The resulting `MetadataSnapshot` captures assets, fields, constraints, lineage edges, operational warnings, and execution provenance.

Serialized metadata snapshots are shared across analytical services, written to disk, and consumed in downstream data governance and data quality processes. However, review identified key integrity risks in the initial deserialization and preflight design:
1. **Silent Checksum Overwrite & Constructor Invariant**: When reconstructing a snapshot via `MetadataSnapshot.from_dict()`, `__post_init__` previously recalculated `self.content_checksum = self.compute_checksum()`, silently replacing any tampered or missing serialized checksum. Conversely, conditioning `__post_init__` on an empty checksum would allow a caller to instantiate `MetadataSnapshot` directly with a forged checksum. A sound design requires that direct construction ALWAYS derives the checksum from the object's actual semantic content, while `from_dict()` validates the serialized checksum against that derived value.
2. **Missing Checksum & Malformed Value Acceptance**: Deserialization accepted payloads without a `content_checksum` key, or containing empty strings, whitespace, or malformed non-hex representations. Furthermore, error messages must not echo untrusted or sensitive input.
3. **Contradictory Derived Counts**: Serialized derived count fields (`asset_count`, `field_count`, `constraint_count`, `lineage_edge_count`, `warning_count`, `error_count`) were ignored or overwritten without verifying consistency against the cardinality of reconstructed collections.
4. **Permissive Manifest Preflight**: In `build_metadata_snapshot()`, an explicitly supplied `manifest_path` that did not exist, pointed to a non-regular file, or contained malformed JSON was not rejected before establishing unnecessary database connections.

## Decision

1. **Deterministic Failure Model with `MetadataIntegrityError`**:
   - Define `MetadataIntegrityError(ValueError)` as the typed exception for metadata deserialization and integrity contract violations.
   - Inheriting from `ValueError` preserves backward compatibility with standard exception handlers while enabling explicit handling of integrity failures.

2. **Invariant: Constructor Always Computes Checksum**:
   - `MetadataSnapshot.__post_init__` unconditionally invokes `self.content_checksum = self.compute_checksum()`. Direct construction cannot preserve an unverified or forged caller-supplied checksum.

3. **Strict Deserialization Flow in `MetadataSnapshot.from_dict()`**:
   - Preserve the serialized `content_checksum` in a local variable.
   - Require `content_checksum` presence, reject empty or whitespace strings, and validate that it strictly matches a 64-character hexadecimal pattern (`^[0-9a-fA-F]{64}$`).
   - Do not echo arbitrary serialized input or sensitive tokens in error messages (e.g., raise `"Malformed content_checksum in serialized metadata snapshot"`).
   - Reconstruct entity collections (`assets`, `fields`, `constraints`, `lineage_edges`, `warnings`, `errors`).
   - Validate serialized derived counts (`asset_count`, `field_count`, `constraint_count`, `lineage_edge_count`, `warning_count`, `error_count`) against reconstructed collection lengths. Reject contradictions with `MetadataIntegrityError`. If omitted, recompute them from collections.
   - Construct `MetadataSnapshot` without trusting the serialized checksum, allowing `__post_init__` to derive the checksum from actual semantic content.
   - Compare the preserved serialized checksum against the computed checksum using `hmac.compare_digest` for constant-time comparison. Reject discrepancies with `MetadataIntegrityError`.
   - Return the snapshot only after successful verification.

4. **Accurate Checksum Scope**:
   - The checksum payload (`_checksum_payload()`) includes:
     - `schema_version`, `extractor_version`, `repository_commit`, `postgres_server_version`, `dbt_version`, `dbt_artifact_schema_version`
     - Canonically sorted `assets`, `fields`, `constraints`, and `lineage_edges`
     - Sorted `warnings` and `errors`
   - The checksum payload does **NOT** include:
     - `snapshot_id`
     - `generated_at`
     - `extraction_sources`
     - `run` (`ExtractionRun` provenance metadata)
     - `content_checksum`
     - Derived counts (`asset_count`, `field_count`, etc.)
   - Derived counts are protected through explicit structural validation in `from_dict()`, not by inclusion in the SHA-256 payload.
   - Canonical JSON serialization uses Python standard library `json.dumps(..., sort_keys=True, separators=(",", ":"))` and is not claimed to implement RFC 8785 (JSON Canonicalization Scheme).

5. **Fail-Closed Manifest Preflight in `build_metadata_snapshot()`**:
   - When `manifest_path` is explicitly provided, verify upfront before initiating database connections that the path exists, is a regular file (not a directory or FIFO), and contains valid JSON. If missing, raise `FileNotFoundError`; if non-regular or malformed JSON, raise `ValueError` with a sanitized message.
   - When `manifest_path` is `None`, preserve default behavior for database-only extractions.
   - Explicit fail-closed preflight for `catalog_path` is deferred to a future milestone where catalog requirements are formally specified.

## Security Considerations & Limitations
- **Modification Detection**: The SHA-256 checksum detects accidental corruption or unauthorized modification of fields within the checksum payload when the expected checksum is received from a trusted channel.
- **Not a Digital Signature**: The checksum is an unkeyed SHA-256 digest. It does **not** provide authenticity or non-repudiation against an adversary capable of modifying both the payload and the checksum. It is not an HMAC (keyed hash) or digital signature.
- **Not Tamper-Proof Storage**: The integrity contract detects deserialization drift against a supplied checksum; it does not protect the underlying storage medium from being overwritten.
- **Sanitized Error Messaging**: Integrity validation exceptions do not reflect untrusted input or file contents, preventing leakage of sensitive tokens or configuration details.
