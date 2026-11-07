{{ config(materialized='view') }}

-- Grain: one row per durable ingestion audit attempt.
--
-- Each row in ingestion_audit_log represents one completed logical ingestion
-- attempt. Replays, conflicts, rejections, and accepted attempts remain
-- separate analytical facts even when they share the same event_id.
--
-- Internal PostgreSQL transaction retries are intentionally not reconstructed
-- from this table. They occur inside a logical ingestion transaction and must
-- not be inferred from durable audit history.

SELECT
    attempt_id,
    event_id,
    event_type,
    outcome,
    rejection_reason,
    processed_at
FROM {{ ref('stg_ingestion_audit') }}