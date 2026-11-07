-- Test: ingestion reconciliation balance
--
-- Grain under test:
-- fct_ingestion_attempts contains one row per durable logical ingestion attempt.
--
-- Invariant:
-- Every committed analytical event must have exactly one accepted ingestion
-- attempt, and every accepted ingestion attempt must reference a committed
-- analytical event.
--
-- Duplicate replays, conflicts, rejections, and failures are valid additional
-- attempts for the same event_id and do not violate this invariant.

WITH accepted_attempts AS (
    SELECT
        event_id,
        COUNT(*) AS accepted_attempt_count
    FROM {{ ref('fct_ingestion_attempts') }}
    WHERE outcome = 'accepted'
    GROUP BY event_id
),

committed_events AS (
    SELECT
        event_id
    FROM {{ ref('stg_analytical_events') }}
),

accepted_without_committed_event AS (
    SELECT
        'accepted_attempt_without_committed_event' AS violation_type,
        a.event_id,
        a.accepted_attempt_count
    FROM accepted_attempts a
    LEFT JOIN committed_events e
        ON a.event_id = e.event_id
    WHERE e.event_id IS NULL
),

committed_event_without_single_accept AS (
    SELECT
        CASE
            WHEN a.event_id IS NULL
                THEN 'committed_event_without_accepted_attempt'
            ELSE 'committed_event_with_multiple_accepted_attempts'
        END AS violation_type,
        e.event_id,
        COALESCE(a.accepted_attempt_count, 0) AS accepted_attempt_count
    FROM committed_events e
    LEFT JOIN accepted_attempts a
        ON e.event_id = a.event_id
    WHERE COALESCE(a.accepted_attempt_count, 0) <> 1
)

SELECT
    violation_type,
    event_id,
    accepted_attempt_count
FROM accepted_without_committed_event

UNION ALL

SELECT
    violation_type,
    event_id,
    accepted_attempt_count
FROM committed_event_without_single_accept