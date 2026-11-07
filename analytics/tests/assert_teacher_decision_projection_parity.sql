-- Test: operational teacher-decision projection parity
--
-- The dbt intermediate model independently reconstructs the current teacher
-- decision state from immutable teacher decision history.
--
-- Invariant:
-- For every teacher decision target, the independently derived state must match
-- the operational current-state projection on decision, winning event identity,
-- and notes.
--
-- The test returns only mismatches. Zero returned rows means parity holds.

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
            d.analysis_run_id,
            o.analysis_run_id
        ) AS analysis_run_id,

        COALESCE(
            d.target_type,
            o.target_type
        ) AS target_type,

        COALESCE(
            d.target_id,
            o.target_id
        ) AS target_id,

        d.teacher_decision AS derived_decision,
        o.teacher_decision AS operational_decision,

        d.event_id AS derived_event_id,
        o.event_id AS operational_event_id,

        d.notes AS derived_notes,
        o.notes AS operational_notes,

        CASE
            WHEN d.analysis_run_id IS NULL
                THEN 'missing_from_derived_state'

            WHEN o.analysis_run_id IS NULL
                THEN 'missing_from_operational_projection'

            WHEN d.teacher_decision IS DISTINCT FROM o.teacher_decision
                THEN 'teacher_decision_mismatch'

            WHEN d.event_id IS DISTINCT FROM o.event_id
                THEN 'winning_event_mismatch'

            WHEN d.notes IS DISTINCT FROM o.notes
                THEN 'notes_mismatch'

            ELSE NULL
        END AS violation_type

    FROM derived d

    FULL OUTER JOIN operational o
        ON d.analysis_run_id = o.analysis_run_id
        AND d.target_type = o.target_type
        AND d.target_id = o.target_id
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
    target_id;