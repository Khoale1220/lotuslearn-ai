-- Test: Operational projection parity
-- Compares dbt-derived current teacher state (from immutable history) against operational projection table.
-- Returns failing rows if there is any mismatch in decisions, event IDs, or missing records.

WITH derived AS (
    SELECT
        analysis_run_id,
        target_type,
        target_id,
        teacher_decision,
        event_id,
        COALESCE(notes, '') AS notes
    FROM {{ ref('int_teacher_decision_ranked') }}
),

operational AS (
    SELECT
        analysis_run_id,
        target_type,
        target_id,
        teacher_decision,
        last_event_id AS event_id,
        COALESCE(notes, '') AS notes
    FROM {{ ref('stg_current_teacher_decisions') }}
)

SELECT
    COALESCE(d.analysis_run_id, o.analysis_run_id) AS analysis_run_id,
    COALESCE(d.target_type, o.target_type) AS target_type,
    COALESCE(d.target_id, o.target_id) AS target_id,
    d.teacher_decision AS derived_decision,
    o.teacher_decision AS operational_decision,
    d.event_id AS derived_event_id,
    o.event_id AS operational_event_id
FROM derived d
FULL OUTER JOIN operational o
    ON d.analysis_run_id = o.analysis_run_id
    AND d.target_type = o.target_type
    AND d.target_id = o.target_id
WHERE
    d.analysis_run_id IS NULL
    OR o.analysis_run_id IS NULL
    OR d.teacher_decision != o.teacher_decision
    OR d.event_id != o.event_id
