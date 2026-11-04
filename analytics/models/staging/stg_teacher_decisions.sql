with source as (
    select * from {{ source('raw_lotuslearn', 'teacher_decisions') }}
),

renamed as (
    select
        event_id,
        analysis_run_id,
        target_type,
        target_id,
        teacher_decision,
        notes,
        recorded_at
    from source
)

select * from renamed
