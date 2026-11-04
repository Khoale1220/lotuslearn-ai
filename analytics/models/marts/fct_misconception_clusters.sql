with clusters as (
    select * from {{ ref('int_cluster_prevalence') }}
),

decisions as (
    select *
    from {{ ref('int_educator_decision_current') }}
    where target_type = 'cluster'
)

select
    c.analysis_run_id,
    c.cluster_id,
    c.concept,
    c.teaching_priority,
    c.affected_students,
    c.total_students,
    c.prevalence_rate,
    c.verified_finding_students_count,
    c.explanation,
    coalesce(d.current_decision, 'pending') as current_educator_decision,
    d.current_notes as educator_notes,
    d.decision_recorded_at as educator_decided_at,
    d.latest_event_id as educator_decision_event_id
from clusters c
left join decisions d
    on c.analysis_run_id = d.analysis_run_id
    and c.cluster_id = d.target_id
