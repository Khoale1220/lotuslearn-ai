{{ config(
    materialized='table',
    contract={'enforced': true}
) }}

-- Grain: one student finding within a misconception cluster within an analysis run
SELECT
    CAST(analysis_run_id AS TEXT) AS analysis_run_id,
    CAST(cluster_id AS TEXT) AS cluster_id,
    CAST(student_id AS TEXT) AS student_id,
    CAST(run_scoped_student_key AS TEXT) AS run_scoped_student_key
FROM {{ ref('stg_student_findings') }}
