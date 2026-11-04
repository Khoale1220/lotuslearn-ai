with source as (
    select * from {{ source('raw_lotuslearn', 'current_teacher_decisions') }}
),

renamed as (
    select
        analysis_run_id,
        target_type,
        target_id,
        teacher_decision,
        notes,
        updated_at,
        last_event_id
    from source
)

select * from renamed
