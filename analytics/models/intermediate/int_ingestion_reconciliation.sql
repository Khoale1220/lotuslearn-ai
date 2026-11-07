{{ config(materialized='view') }}

-- Grain: one row per unique event_id in ingestion audit log
-- Reconciles multiple physical transaction attempts/retries into one logical ingestion attempt
WITH ranked_attempts AS (
    SELECT
        event_id,
        event_type,
        outcome,
        rejection_reason,
        processed_at,
        ROW_NUMBER() OVER (
            PARTITION BY event_id
            ORDER BY attempt_id DESC
        ) AS attempt_rank_desc,
        COUNT(*) OVER (
            PARTITION BY event_id
        ) AS total_attempts,
        MIN(processed_at) OVER (
            PARTITION BY event_id
        ) AS first_attempt_at,
        MAX(processed_at) OVER (
            PARTITION BY event_id
        ) AS last_attempt_at
    FROM {{ ref('stg_ingestion_audit') }}
)

SELECT
    event_id,
    event_type,
    outcome AS final_outcome,
    rejection_reason,
    total_attempts,
    first_attempt_at,
    last_attempt_at
FROM ranked_attempts
WHERE attempt_rank_desc = 1
