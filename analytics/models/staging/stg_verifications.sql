with source as (
    select * from {{ source('raw_lotuslearn', 'verifications') }}
),

renamed as (
    select
        analysis_run_id,
        overall_status,
        coverage_passed,
        cluster_math_passed,
        group_partition_passed,
        quotes_grounded_count::integer as quotes_grounded_count,
        quotes_flagged_count::integer as quotes_flagged_count
    from source
)

select * from renamed
