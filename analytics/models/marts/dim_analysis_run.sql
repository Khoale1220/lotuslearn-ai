{{ config(
    materialized='table',
    contract={'enforced': true}
) }}

-- Grain: one row per analysis run
SELECT
    CAST(run_id AS TEXT) AS run_id,
    CAST(dataset_fingerprint AS TEXT) AS dataset_fingerprint,
    CAST(submission_count AS INTEGER) AS submission_count,
    CAST(subject AS TEXT) AS subject,
    CAST(grade_level AS TEXT) AS grade_level,
    CAST(total_duration_ms AS INTEGER) AS total_duration_ms,
    CAST(execution_mode AS TEXT) AS execution_mode,
    CAST(occurred_at AS TIMESTAMPTZ) AS occurred_at
FROM {{ ref('stg_analysis_runs') }}
