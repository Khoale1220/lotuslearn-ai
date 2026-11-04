-- Asserts that instructional group declared student_count matches the count of assigned group memberships
with declared as (
    select
        analysis_run_id,
        group_id,
        student_count as declared_count
    from {{ ref('stg_instructional_groups') }}
),

actual as (
    select
        analysis_run_id,
        group_id,
        count(distinct student_id)::integer as actual_count
    from {{ ref('stg_group_memberships') }}
    group by analysis_run_id, group_id
)

select
    d.analysis_run_id,
    d.group_id,
    d.declared_count,
    coalesce(a.actual_count, 0) as actual_count
from declared d
left join actual a
    on d.analysis_run_id = a.analysis_run_id
    and d.group_id = a.group_id
where d.declared_count != coalesce(a.actual_count, 0)
