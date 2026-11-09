# ADR 008: Durable Metadata History

## Status
Accepted

## Context

DE-04A established integrity-checked metadata snapshots. DE-04B.1 added pure
deterministic comparison and lineage-impact analysis. Durable governance now
requires retaining observations and comparisons without confusing semantic
content identity with capture identity or introducing mutable history.

The semantic `content_checksum` intentionally excludes observation-level
values, including `snapshot_id`, `generated_at`, `extraction_sources`, and
extraction-run metadata. Distinct captures can therefore have the same
semantic checksum and still be separate valid observations.

## Decision

### Append-only observation identity

`metadata_snapshot_history.snapshot_id` is the primary key and observation
identity. `content_checksum` is semantic-content lookup metadata, not a
history key. A new snapshot ID is a new observation even when its semantic
checksum matches an earlier observation. The store exposes no update or delete
operation and never uses `ON CONFLICT DO UPDATE`.

An exact replay of the same snapshot ID and canonical persisted representation
returns `EXISTING`. The same ID with different immutable content raises
`MetadataHistoryConflictError`. This is idempotent/effectively-once persistence
for stable observation identities, not end-to-end exactly-once delivery.

### Comparison observation identity

`metadata_diff_history` uses `(baseline_snapshot_id, current_snapshot_id)` as
its primary key and foreign-keys both references to snapshot history. The
deterministic `comparison_id` is indexed but not unique: separate observation
pairs can represent the same semantic comparison ID. Exact replay for a pair
returns `EXISTING`; differing content for that pair raises a conflict.

### Transactions and concurrency

`record_comparison` validates both inputs, computes the DE-04B.1 diff, and
checks checksum correspondence before opening a database transaction. Within
one transaction it idempotently records both observations and then the diff.
Any failure rolls back every new row from the operation.

PostgreSQL primary/unique constraints and `INSERT ... ON CONFLICT DO NOTHING`
arbitrate concurrent writers. The store then reads and verifies the row after
a conflict. It does not use select-before-insert, mutable upserts, or
application advisory locks. Default `READ COMMITTED` isolation is sufficient
for these uniqueness-arbitrated writes. `execute_with_retry` retries only
SQLSTATE `40001` and `40P01`; immutable conflicts and validation/integrity
errors are not retried.

### Schema and read integrity

Migration `0003_metadata_history.sql` stores JSONB payloads plus relational
identity, checksum, timestamp, version, commit, and count columns. Primary
keys, foreign keys, checksum checks, non-negative counts, and JSON-object
checks make core invariants database-enforced. Snapshot reads reconstruct via
`MetadataSnapshot.from_dict`, revalidate the checksum, and compare the payload
with relational summaries. Comparison reads reload and verify both snapshots,
recompute the diff with DE-04B.1, and compare its serialization and summaries
with the persisted projection. Corruption fails closed; no read path repairs
stored data.

### Indexes, retention, and privacy

B-tree indexes support checksum lookup, latest snapshot ordering, comparison ID
lookup, current-snapshot lookup, and recent comparison ordering. No
repository-commit index is added because no API queries it. There are no GIN,
BRIN, hash, or partial indexes without an access path.

History is append-only with no automatic TTL or pruning. Future retention may
consider age-based policy, archival, or compaction after audit/legal needs and
measured volume are understood. Partitioning or BRIN may be evaluated only
after history volume and query plans justify the operational cost; no
partitioning is introduced now.

Persistence uses the existing sanitized snapshot serializer and
privacy-safe diff serializer. Database URLs, credentials, arbitrary free text,
and raw payloads are not included in error messages or logs.

## Consequences and limitations

The store provides durable idempotency for stable observation identities and
integrity-checked read projections. It is not tamper-proof storage and does not
provide cryptographic authenticity. It does not claim universal schema
compatibility or exactly-once end-to-end delivery. API/CLI exposure, automated
retention, DE-04B.3 governance policy, OpenLineage publication, and
large-scale partitioning remain deferred.