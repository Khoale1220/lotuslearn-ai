# ADR 002: PostgreSQL Durable Persistence Implementation

## Context

In milestone DE-01.1, LotusLearn established an analytical event schema contract and an in-memory SQLite storage engine for event ingestion, audit logging, and relational rollup metrics. While SQLite remains optimal for fast unit tests, hermetic CI verification, and local development, durable persistence requires a client-server relational database supporting concurrent ingestion, ACID transactions, and native JSONB analytical query capabilities.

## Decision

Implement PostgreSQL 18 via Psycopg 3 as the primary durable relational persistence backend for milestone DE-02A. Preserve SQLite as the lightweight development and testing backend. Business semantics, event identity, validation rules, replay behavior, conflict detection, and authoritative SQL metric calculations remain identical across both backends.

## Why PostgreSQL 18

PostgreSQL 18 provides:
- Proven ACID transactional durability with transactional DDL support for deterministic migrations.
- Native TIMESTAMPTZ support for UTC timestamps and timezone-aware event ordering.
- High-performance binary JSONB storage for canonical analytical event envelopes with indexing capabilities.
- Native boolean types and robust check constraints for rigorous data integrity.
- First-class support via Psycopg 3 with native Python typing and binary protocol speed.

## Alternatives Considered

- SQLite only: Sufficient for single-process local workloads, but lacks multi-connection concurrency and client-server network architecture required for distributed ingestion.
- Oracle Database: Strong candidate for enterprise statewide deployments, but incurs higher operational licensing overhead and heavier setup complexity for milestone DE-02A.
- MySQL: Widespread adoption, but less mature JSON indexing and lacks transactional DDL for reliable schema migration rollbacks.

## Consequences

- Adds psycopg[binary] as a dependency in the Python pipeline package.
- Requires PostgreSQL connection configuration via LOTUSLEARN_DATABASE_URL for durable runs and integration tests.
- Requires dual-backend parity testing to ensure SQL queries, conflict resolution, and teacher decision projections execute identically.

## Future Oracle Evaluation

Oracle remains a candidate for future evaluation in subsequent milestones for district enterprise tiers. Schema migrations and analytical views strictly follow ANSI SQL conventions to guarantee clean migration feasibility if enterprise procurement requirements demand Oracle deployment.
