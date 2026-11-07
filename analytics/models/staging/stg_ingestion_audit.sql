{{ config(materialized='view') }}

-- Grain: one physical ingestion attempt
SELECT
    CAST(attempt_id AS BIGINT) AS attempt_id,
    CAST(event_id AS TEXT) AS event_id,
    CAST(event_type AS TEXT) AS event_type,
    CAST(outcome AS TEXT) AS outcome,
    CAST(rejection_reason AS TEXT) AS rejection_reason,
    CAST(processed_at AS TIMESTAMPTZ) AS processed_at
FROM {{ source('lotuslearn_operational', 'ingestion_audit_log') }}
