-- Test: Ingestion reconciliation balance
-- Asserts that every accepted logical ingestion attempt exists in the analytical_events envelope store.
-- Returns any accepted attempt missing from committed storage.

SELECT
    a.event_id,
    a.final_outcome,
    a.first_attempt_at
FROM {{ ref('fct_ingestion_attempts') }} a
LEFT JOIN {{ ref('stg_analytical_events') }} e
    ON a.event_id = e.event_id
WHERE
    a.final_outcome = 'accepted'
    AND e.event_id IS NULL
