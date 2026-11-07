{{ config(
    materialized='table',
    contract={'enforced': true}
) }}

-- Grain: one row per durable logical ingestion attempt.
--
-- attempt_id is the fact identity.
-- Multiple attempts may legitimately share the same event_id, including
-- accepted ingestion, duplicate replay, payload conflict, rejection, or failure.
--
-- Internal PostgreSQL transaction retries are not represented as separate rows
-- unless the operational audit layer explicitly persists them as logical attempts.

SELECT
    CAST(attempt_id AS BIGINT) AS attempt_id,
    CAST(event_id AS TEXT) AS event_id,
    CAST(event_type AS TEXT) AS event_type,
    CAST(outcome AS TEXT) AS outcome,
    CAST(rejection_reason AS TEXT) AS rejection_reason,
    CAST(processed_at AS TIMESTAMPTZ) AS processed_at
FROM {{ ref('int_ingestion_reconciliation') }}