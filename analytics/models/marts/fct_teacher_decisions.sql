{{ config(
    materialized='table',
    contract={'enforced': true}
) }}

-- Grain: one row per immutable teacher decision event
SELECT
    CAST(event_id AS TEXT) AS event_id,
    CAST(analysis_run_id AS TEXT) AS analysis_run_id,
    CAST(target_type AS TEXT) AS target_type,
    CAST(target_id AS TEXT) AS target_id,
    CAST(teacher_decision AS TEXT) AS teacher_decision,
    CAST(notes AS TEXT) AS notes,
    CAST(decision_recorded_at AS TIMESTAMPTZ) AS decision_recorded_at
FROM {{ ref('stg_teacher_decisions') }}
