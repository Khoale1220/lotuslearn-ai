{{ config(materialized='view') }}

-- Grain: one verification audit per analysis run
SELECT
    CAST(analysis_run_id AS TEXT) AS analysis_run_id,
    CAST(overall_status AS TEXT) AS overall_status,
    CAST(coverage_passed AS BOOLEAN) AS coverage_passed,
    CAST(cluster_math_passed AS BOOLEAN) AS cluster_math_passed,
    CAST(group_partition_passed AS BOOLEAN) AS group_partition_passed,
    CAST(quotes_grounded_count AS INTEGER) AS quotes_grounded_count,
    CAST(quotes_flagged_count AS INTEGER) AS quotes_flagged_count,
    -- Fully verified requires all atomic criteria to pass fail-closed
    CAST(
        overall_status = 'verified'
        AND coverage_passed = TRUE
        AND cluster_math_passed = TRUE
        AND group_partition_passed = TRUE
        AS BOOLEAN
    ) AS is_fully_verified
FROM {{ source('lotuslearn_operational', 'verifications') }}
