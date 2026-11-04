with source as (
    select * from {{ source('raw_lotuslearn', 'ingestion_audit_log') }}
),

renamed as (
    select
        attempt_id,
        event_id,
        event_type,
        outcome,
        rejection_reason,
        processed_at
    from source
)

select * from renamed
