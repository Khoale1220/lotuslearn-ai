with findings as (
    select
        analysis_run_id,
        student_id,
        count(distinct cluster_id)::integer as findings_count
    from {{ ref('stg_student_findings') }}
    group by analysis_run_id, student_id
),

groups as (
    select
        analysis_run_id,
        student_id,
        count(distinct group_id)::integer as assigned_groups_count
    from {{ ref('stg_group_memberships') }}
    group by analysis_run_id, student_id
),

all_students as (
    select analysis_run_id, student_id from findings
    union
    select analysis_run_id, student_id from groups
)

select
    s.analysis_run_id,
    s.student_id,
    coalesce(f.findings_count, 0) as findings_count,
    coalesce(g.assigned_groups_count, 0) as assigned_groups_count
from all_students s
left join findings f
    on s.analysis_run_id = f.analysis_run_id
    and s.student_id = f.student_id
left join groups g
    on s.analysis_run_id = g.analysis_run_id
    and s.student_id = g.student_id
