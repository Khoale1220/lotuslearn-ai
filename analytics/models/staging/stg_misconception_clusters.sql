with source as (
    select * from {{ source('raw_lotuslearn', 'misconception_clusters') }}
),

renamed as (
    select
        analysis_run_id,
        cluster_id,
        concept,
        teaching_priority,
        affected_student_count::integer as affected_student_count,
        percentage_affected::double precision as percentage_affected,
        explanation
    from source
)

select * from renamed
