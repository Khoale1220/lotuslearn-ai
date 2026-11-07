{{ config(materialized='view') }}

-- Grain: one row per teacher decision target per analysis run
-- Independent analytical reconstruction of current teacher state derived from immutable history
WITH ranked_decisions AS (
    SELECT
        event_id,
        analysis_run_id,
        target_type,
        target_id,
        teacher_decision,
        notes,
        decision_recorded_at,
        ROW_NUMBER() OVER (
            PARTITION BY analysis_run_id, target_type, target_id
            ORDER BY decision_recorded_at DESC, event_id DESC
        ) AS ranking
    FROM {{ ref('stg_teacher_decisions') }}
)

SELECT
    event_id,
    analysis_run_id,
    target_type,
    target_id,
    teacher_decision,
    notes,
    decision_recorded_at
FROM ranked_decisions
WHERE ranking = 1
