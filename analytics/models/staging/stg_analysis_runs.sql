with source as (
    select * from {{ source('raw_lotuslearn', 'analysis_runs') }}
),

renamed as (
    select
        run_id as analysis_run_id,
        dataset_fingerprint,
        submission_count::integer as submission_count,
        subject,
        grade_level,
        total_duration_ms::integer as total_duration_ms,
        execution_mode,
        occurred_at
    from source
)

select * from renamed
