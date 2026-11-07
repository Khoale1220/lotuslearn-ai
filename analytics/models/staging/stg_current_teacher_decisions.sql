{{ config(materialized='view') }}

-- Grain: one operational current teacher decision per target within an analysis run
SELECT
    CAST(analysis_run_id AS TEXT) AS analysis_run_id,
    CAST(target_type AS TEXT) AS target_type,
    CAST(target_id AS TEXT) AS target_id,
    CAST(teacher_decision AS TEXT) AS teacher_decision,
    CAST(notes AS TEXT) AS notes,
    CAST(updated_at AS TIMESTAMPTZ) AS updated_at,
    CAST(last_event_id AS TEXT) AS last_event_id
FROM {{ source('lotuslearn_operational', 'current_teacher_decisions') }}
