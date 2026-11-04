with current_decisions as (
    select * from {{ ref('int_educator_decision_current') }}
),

aggregated as (
    select
        analysis_run_id,
        count(case when current_decision = 'accepted' then 1 end)::integer as count_accepted,
        count(case when current_decision = 'edited' then 1 end)::integer as count_edited,
        count(case when current_decision = 'dismissed' then 1 end)::integer as count_dismissed,
        count(case when current_decision in ('accepted', 'edited', 'dismissed') then 1 end)::integer as total_reviewed
    from current_decisions
    group by analysis_run_id
)

select
    analysis_run_id,
    count_accepted,
    count_edited,
    count_dismissed,
    total_reviewed,
    case
        when total_reviewed > 0 then
            round(
                cast(cast(count_edited + count_dismissed as real) / cast(total_reviewed as real) as numeric),
                4
            )
        else null
    end as educator_modification_rate
from aggregated
