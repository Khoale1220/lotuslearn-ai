with runs as (
    select * from {{ ref('fct_analysis_runs') }}
),

cluster_agg as (
    select
        analysis_run_id,
        count(case when teaching_priority = 'immediate' then 1 end)::integer as immediate_priority_clusters,
        count(case when teaching_priority = 'guided_group' then 1 end)::integer as guided_group_priority_clusters,
        count(case when teaching_priority = 'reinforce' then 1 end)::integer as reinforce_priority_clusters,
        count(case when teaching_priority = 'monitor' then 1 end)::integer as monitor_priority_clusters,
        max(prevalence_rate) as max_cluster_prevalence,
        round(avg(prevalence_rate), 4) as avg_cluster_prevalence
    from {{ ref('fct_misconception_clusters') }}
    group by analysis_run_id
)

select
    r.analysis_run_id,
    r.subject,
    r.grade_level,
    r.dataset_fingerprint,
    r.submission_count,
    r.distinct_students_count,
    r.total_clusters_count,
    r.total_groups_count,
    r.total_duration_ms,
    r.execution_mode,
    r.occurred_at,
    r.verification_status,
    r.is_fully_verified,
    coalesce(ca.immediate_priority_clusters, 0) as immediate_priority_clusters,
    coalesce(ca.guided_group_priority_clusters, 0) as guided_group_priority_clusters,
    coalesce(ca.reinforce_priority_clusters, 0) as reinforce_priority_clusters,
    coalesce(ca.monitor_priority_clusters, 0) as monitor_priority_clusters,
    ca.max_cluster_prevalence,
    ca.avg_cluster_prevalence,
    r.count_decisions_accepted,
    r.count_decisions_edited,
    r.count_decisions_dismissed,
    r.total_decisions_reviewed,
    r.educator_modification_rate
from runs r
left join cluster_agg ca on r.analysis_run_id = ca.analysis_run_id
