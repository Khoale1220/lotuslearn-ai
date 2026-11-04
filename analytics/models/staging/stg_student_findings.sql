with source as (
    select * from {{ source('raw_lotuslearn', 'student_findings') }}
),

renamed as (
    select
        analysis_run_id,
        cluster_id,
        student_id
    from source
)

select * from renamed
