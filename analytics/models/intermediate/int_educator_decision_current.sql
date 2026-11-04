with ranked_decisions as (
    select
        event_id,
        analysis_run_id,
        target_type,
        target_id,
        teacher_decision,
        notes,
        recorded_at,
        row_number() over (
            partition by analysis_run_id, target_type, target_id
            order by recorded_at desc, event_id desc
        ) as decision_rank
    from {{ ref('stg_teacher_decisions') }}
)

select
    event_id as latest_event_id,
    analysis_run_id,
    target_type,
    target_id,
    teacher_decision as current_decision,
    notes as current_notes,
    recorded_at as decision_recorded_at
from ranked_decisions
where decision_rank = 1
