-- Asserts that all historical educator decisions survive into fct_teacher_decisions
-- and historical event count matches source event count
with history_source as (
    select count(*)::integer as source_count from {{ ref('stg_teacher_decisions') }}
),

mart_history as (
    select count(*)::integer as mart_count from {{ ref('fct_teacher_decisions') }}
)

select
    s.source_count,
    m.mart_count
from history_source s
cross join mart_history m
where s.source_count != m.mart_count
