with runs as (
    select * from {{ ref('stg_analysis_runs') }}
),

students as (
    select
        analysis_run_id,
        count(distinct student_id)::integer as distinct_students_count
    from {{ ref('int_run_scoped_students') }}
    group by analysis_run_id
),

clusters as (
    select
        analysis_run_id,
        count(distinct cluster_id)::integer as total_clusters_count,
        sum(affected_students)::integer as total_affected_student_instances
    from {{ ref('int_cluster_prevalence') }}
    group by analysis_run_id
),

groups as (
    select
        analysis_run_id,
        count(distinct group_id)::integer as total_groups_count
    from {{ ref('stg_instructional_groups') }}
    group by analysis_run_id
),

quality as (
    select * from {{ ref('int_run_quality') }}
),

decisions as (
    select * from {{ ref('int_educator_decision_metrics') }}
)

select
    r.analysis_run_id,
    r.dataset_fingerprint,
    r.submission_count,
    r.subject,
    r.grade_level,
    r.total_duration_ms,
    r.execution_mode,
    r.occurred_at,
    coalesce(s.distinct_students_count, 0) as distinct_students_count,
    coalesce(c.total_clusters_count, 0) as total_clusters_count,
    coalesce(c.total_affected_student_instances, 0) as total_affected_student_instances,
    coalesce(g.total_groups_count, 0) as total_groups_count,
    coalesce(q.verification_status, 'needs_review') as verification_status,
    coalesce(q.is_fully_verified, false) as is_fully_verified,
    coalesce(q.coverage_passed, false) as coverage_passed,
    coalesce(q.cluster_math_passed, false) as cluster_math_passed,
    coalesce(q.group_partition_passed, false) as group_partition_passed,
    coalesce(q.quotes_grounded_count, 0) as quotes_grounded_count,
    coalesce(q.quotes_flagged_count, 0) as quotes_flagged_count,
    coalesce(d.count_accepted, 0) as count_decisions_accepted,
    coalesce(d.count_edited, 0) as count_decisions_edited,
    coalesce(d.count_dismissed, 0) as count_decisions_dismissed,
    coalesce(d.total_reviewed, 0) as total_decisions_reviewed,
    d.educator_modification_rate
from runs r
left join students s on r.analysis_run_id = s.analysis_run_id
left join clusters c on r.analysis_run_id = c.analysis_run_id
left join groups g on r.analysis_run_id = g.analysis_run_id
left join quality q on r.analysis_run_id = q.analysis_run_id
left join decisions d on r.analysis_run_id = d.analysis_run_id
