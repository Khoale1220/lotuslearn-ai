{{ config(
    materialized='table',
    contract={'enforced': true}
) }}

-- Grain: one logical ingestion attempt per event_id
SELECT
    CAST(event_id AS TEXT) AS event_id,
    CAST(event_type AS TEXT) AS event_type,
    CAST(final_outcome AS TEXT) AS final_outcome,
    CAST(rejection_reason AS TEXT) AS rejection_reason,
    CAST(total_attempts AS INTEGER) AS total_attempts,
    CAST(first_attempt_at AS TIMESTAMPTZ) AS first_attempt_at,
    CAST(last_attempt_at AS TIMESTAMPTZ) AS last_attempt_at
FROM {{ ref('int_ingestion_reconciliation') }}
