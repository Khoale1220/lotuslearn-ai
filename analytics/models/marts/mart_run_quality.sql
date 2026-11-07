{{ config(
    materialized='table',
    contract={'enforced': true}
) }}

-- Grain: one row per analysis run
WITH run_findings AS (
    SELECT
        analysis_run_id,
        COUNT(*)::INTEGER AS finding_count
    FROM {{ ref('stg_misconception_clusters') }}
    GROUP BY analysis_run_id
),

run_students AS (
    SELECT
        analysis_run_id,
        COUNT(*)::INTEGER AS student_appearances_count
    FROM {{ ref('int_student_appearances') }}
    GROUP BY analysis_run_id
),

run_decisions AS (
    SELECT
        analysis_run_id,
        COUNT(*)::INTEGER AS teacher_decisions_reviewed_count,
        COUNT(CASE WHEN teacher_decision IN ('edited', 'dismissed') THEN 1 END)::INTEGER AS teacher_modifications_count
    FROM {{ ref('int_teacher_decision_ranked') }}
    WHERE teacher_decision IN ('accepted', 'edited', 'dismissed')
    GROUP BY analysis_run_id
)

SELECT
    CAST(r.run_id AS TEXT) AS run_id,
    CAST(r.dataset_fingerprint AS TEXT) AS dataset_fingerprint,
    CAST(r.subject AS TEXT) AS subject,
    CAST(r.grade_level AS TEXT) AS grade_level,
    CAST(r.submission_count AS INTEGER) AS submission_count,
    CAST(COALESCE(f.finding_count, 0) AS INTEGER) AS finding_count,
    CAST(COALESCE(s.student_appearances_count, 0) AS INTEGER) AS student_appearances_count,
    CAST(COALESCE(d.teacher_decisions_reviewed_count, 0) AS INTEGER) AS teacher_decisions_reviewed_count,
    CAST(COALESCE(d.teacher_modifications_count, 0) AS INTEGER) AS teacher_modifications_count,
    CAST(
        CASE
            WHEN COALESCE(d.teacher_decisions_reviewed_count, 0) > 0 THEN
                ROUND(
                    CAST(CAST(d.teacher_modifications_count AS NUMERIC) /
                         CAST(d.teacher_decisions_reviewed_count AS NUMERIC) AS NUMERIC),
                    4
                )
            ELSE NULL
        END AS NUMERIC
    ) AS educator_modification_rate,
    CAST(COALESCE(v.overall_status, 'unverified') AS TEXT) AS verification_status,
    CAST(COALESCE(v.is_fully_verified, FALSE) AS BOOLEAN) AS is_fully_verified,
    CAST(COALESCE(v.quotes_grounded_count, 0) AS INTEGER) AS quotes_grounded_count,
    CAST(COALESCE(v.quotes_flagged_count, 0) AS INTEGER) AS quotes_flagged_count,
    CAST(r.occurred_at AS TIMESTAMPTZ) AS occurred_at
FROM {{ ref('stg_analysis_runs') }} r
LEFT JOIN run_findings f ON r.run_id = f.analysis_run_id
LEFT JOIN run_students s ON r.run_id = s.analysis_run_id
LEFT JOIN run_decisions d ON r.run_id = d.analysis_run_id
LEFT JOIN {{ ref('stg_verifications') }} v ON r.run_id = v.analysis_run_id
