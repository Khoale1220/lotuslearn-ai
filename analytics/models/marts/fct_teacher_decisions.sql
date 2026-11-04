with historical as (
    select * from {{ ref('stg_teacher_decisions') }}
),

events as (
    select
        event_id,
        schema_version,
        provenance,
        occurred_at as event_occurred_at
    from {{ ref('stg_analytical_events') }}
)

select
    h.event_id,
    h.analysis_run_id,
    h.target_type,
    h.target_id,
    h.teacher_decision,
    h.notes,
    h.recorded_at as decision_recorded_at,
    e.schema_version,
    e.provenance,
    e.event_occurred_at
from historical h
join events e on h.event_id = e.event_id
