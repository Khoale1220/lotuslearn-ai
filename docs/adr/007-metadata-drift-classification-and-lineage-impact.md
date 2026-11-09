# ADR 007: Metadata Drift Classification and Lineage Impact Analysis

## Status
Accepted

## Context

DE-04A established canonical metadata snapshots and integrity checks. A
snapshot checksum also covers operational provenance, including the repository
commit and extractor metadata. Comparing snapshot checksums alone would
therefore report false schema drift when only provenance changes. Governance
needs deterministic entity-level differences and a conservative view of
downstream assets, without persisting history or guessing at compatibility.

PostgreSQL DDL event triggers can observe database-specific changes, but they
do not compare the complete PostgreSQL-plus-dbt metadata graph and would couple
this milestone to database-side history capture. Snapshot comparison is the
primary semantic mechanism. A future durable history store may use the
resulting contract; DE-04B.1 adds no database tables, migrations, triggers, or
external catalog dependencies.

## Decision

### Comparison and integrity

`compare_metadata_snapshots` validates both inputs with the existing
`validate_metadata_snapshot` contract before comparing them. This detects a
stale checksum after mutable snapshot content changes. Invalid input raises a
generic `MetadataIntegrityError` that does not include validation details or
raw metadata.

Only assets, fields, constraints, and lineage edges create structural changes.
Operational metadata such as `repository_commit` can change snapshot checksums
without creating structural drift. No timestamp or random identifier is used
for comparison identity.

### Entity identities

- **Asset:** `asset_id`, already derived from platform, database, schema, and
  relation name. A rename is an asset removal plus an asset addition. Rename
  intent is not inferred.
- **Field:** `(asset_id, field_name)`.
- **Constraint:** `(owning_asset, constraint_name, constraint_type)`. The
  constraint type is identity-bearing; changing it is represented as removal
  plus addition. Other constraint attributes are mutable properties.
- **Lineage edge:** `(source_asset, target_asset, edge_type)`. Changing the
  edge type is removal plus addition; field-level mappings, evidence source,
  and transformation owner are mutable properties.

Duplicate constraint identities are rejected rather than silently collapsed.
Existing snapshot validation rejects duplicate assets, fields, and lineage
edges.

### Severity policy

This is a conservative LotusLearn review policy, not proof of universal
producer/consumer compatibility. Type compatibility is not inferred across
database dialects.

| Change | Severity |
| --- | --- |
| Asset removed; field removed; field type changed | `BREAKING` |
| Required field added without a non-empty default | `BREAKING` |
| Nullable field added, or required field added with a default | `NON_BREAKING` |
| Asset added; lineage edge added | `NON_BREAKING` |
| Field becomes nullable | `REVIEW_REQUIRED` |
| Field becomes non-nullable from nullable or unknown | `BREAKING` |
| Asset type, materialization, owner, or source metadata changed | `REVIEW_REQUIRED` |
| Field default or ordinal position changed | `REVIEW_REQUIRED` |
| Constraint added, removed, or modified | `REVIEW_REQUIRED` |
| Lineage edge removed or modified | `REVIEW_REQUIRED` |
| Asset or field description changed | `METADATA_ONLY` |

`classify_metadata_change_severity` is the single policy function so later CI
gates can evolve the policy independently of entity comparison.

### Privacy-safe diagnostics and deterministic IDs

Change payloads include structural identities, property names, booleans, and
ordinal positions. Standard type, materialization, constraint, and edge labels
are emitted only from explicit allowlists; unrecognized values are redacted.
Descriptions, owners, source paths, database URLs, default expressions, and
lineage evidence values are not copied into change payloads. Field names are
emitted only when they pass a conservative identifier check; otherwise they
are redacted. Asset and related-asset IDs are emitted as SHA-256-shaped
identifiers, hashing any noncanonical ID value.

`comparison_id` is SHA-256 over the ordered baseline/current checksums.
`change_id` is SHA-256 over that pair, entity identity, change kind, and
canonical safe before/after values. IDs contain no UUID or generated time.
Changes sort by severity rank, entity type, asset ID, field name, change kind,
and change ID. Serialization is deterministic and contains no `generated_at`.

### Lineage impact

Lineage is directed `source_asset -> target_asset`. Direct asset changes from
assets, fields, and constraints seed traversal from the asset itself. For a
changed lineage relationship, its target asset is the directly affected asset
and seeds traversal. `directly_changed_assets` and
`downstream_impacted_assets` remain separate; directly changed assets are
excluded from downstream results.

Traversal uses the union of baseline and current graphs so removed and added
relationships are represented conservatively. Adjacencies are sets, traversal
is iterative and cycle-safe, and all public asset lists are sorted and unique.
Field and constraint changes seed impact from their owning asset. This reports
graph reachability only; it does not infer business criticality, consumer
popularity, SLAs, or rename relationships.

## Alternatives and references

- dbt prior-state artifacts demonstrate snapshot-based state comparison; this
  ADR does not claim to implement dbt state selection.
- Backward/forward schema compatibility terminology informs review, but this
  project does not implement Avro or Protobuf compatibility semantics.
- PostgreSQL DDL event triggers remain a possible future capture mechanism,
  not the primary drift classifier.
- OpenLineage and schema registries are not implemented or claimed.

## Consequences and limitations

The comparison is pure and can be tested without PostgreSQL. It does not
persist history, detect renames, infer dialect-specific type widening, validate
business semantics, or guarantee that a producer/consumer pair is compatible.
Durable metadata history belongs to a later milestone after these change
semantics have been reviewed.