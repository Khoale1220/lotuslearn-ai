with source as (
    select * from {{ source('raw_lotuslearn', 'instructional_groups') }}
),

renamed as (
    select
        analysis_run_id,
        group_id,
        group_name,
        student_count::integer as student_count,
        suggested_activity,
        estimated_duration
    from source
)

select * from renamed
