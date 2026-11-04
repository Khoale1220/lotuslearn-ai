with source as (
    select * from {{ source('raw_lotuslearn', 'analytical_events') }}
),

renamed as (
    select
        event_id,
        schema_version,
        event_type,
        analysis_run_id,
        provenance,
        payload_json,
        occurred_at
    from source
)

select * from renamed
