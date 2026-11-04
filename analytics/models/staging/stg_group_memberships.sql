with source as (
    select * from {{ source('raw_lotuslearn', 'group_memberships') }}
),

renamed as (
    select
        analysis_run_id,
        group_id,
        student_id
    from source
)

select * from renamed
