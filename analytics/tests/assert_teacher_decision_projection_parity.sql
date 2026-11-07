-- Test: operational teacher-decision projection parity
--
-- The dbt intermediate model independently reconstructs the current teacher
-- decision state from immutable teacher decision history.
--
-- Invariant:
-- For every teacher decision target, the independently derived state must
-- match the operational current-state projection on decision, winning event
-- identity, and notes.
--
-- Zero returned rows means parity holds.

WITH derived AS (
    SELECT
        analysis_run_id,
        target_type,
        target_id,
        teacher_decision,
        event_id,
        notes
    FROM {{ ref('int_teacher_decision_ranked') }}
),

operational AS (
    SELECT
        analysis_run_id,
        target_type,
        target_id,
        teacher_decision,
        last_event_id AS event_id,
        notes
    FROM {{ ref('stg_current_teacher_decisions') }}
),

comparison AS (
    SELECT
        COALESCE(
            derived.analysis_run_id,
            operational.analysis_run_id
        ) AS analysis_run_id,

        COALESCE(
            derived.target_type,
            operational.target_type
        ) AS target_type,

        COALESCE(
            derived.target_id,
            operational.target_id
        ) AS target_id,

        derived.teacher_decision AS derived_decision,
        operational.teacher_decision AS operational_decision,

        derived.event_id AS derived_event_id,
        operational.event_id AS operational_event_id,

        derived.notes AS derived_notes,
        operational.notes AS operational_notes,

        CASE
            WHEN derived.analysis_run_id IS NULL
                THEN 'missing_from_derived_state'

            WHEN operational.analysis_run_id IS NULL
                THEN 'missing_from_operational_projection'

            WHEN derived.teacher_decision
                 IS DISTINCT FROM operational.teacher_decision
                THEN 'teacher_decision_mismatch'

            WHEN derived.event_id
                 IS DISTINCT FROM operational.event_id
                THEN 'winning_event_mismatch'

            WHEN derived.notes
                 IS DISTINCT FROM operational.notes
                THEN 'notes_mismatch'

            ELSE NULL
        END AS violation_type

    FROM derived

    FULL OUTER JOIN operational
        ON derived.analysis_run_id = operational.analysis_run_id
        AND derived.target_type = operational.target_type
        AND derived.target_id = operational.target_id
)

SELECT
    violation_type,
    analysis_run_id,
    target_type,
    target_id,
    derived_decision,
    operational_decision,
    derived_event_id,
    operational_event_id,
    derived_notes,
    operational_notes
FROM comparison
WHERE violation_type IS NOT NULL
ORDER BY
    analysis_run_id,
    target_type,
    target_id