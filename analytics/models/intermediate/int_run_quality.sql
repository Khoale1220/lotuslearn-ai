with runs as (
    select * from {{ ref('stg_analysis_runs') }}
),

verifications as (
    select * from {{ ref('stg_verifications') }}
),

audits as (
    select
        ae.analysis_run_id,
        count(case when al.outcome = 'accepted' then 1 end)::integer as accepted_events_count,
        count(case when al.outcome = 'duplicate' then 1 end)::integer as duplicate_attempts_count,
        count(case when al.outcome = 'conflict' then 1 end)::integer as conflict_attempts_count
    from {{ ref('stg_ingestion_audit') }} al
    join {{ ref('stg_analytical_events') }} ae on al.event_id = ae.event_id
    group by ae.analysis_run_id
)

select
    r.analysis_run_id,
    v.overall_status as verification_status,
    v.coverage_passed,
    v.cluster_math_passed,
    v.group_partition_passed,
    v.quotes_grounded_count,
    v.quotes_flagged_count,
    case
        when v.coverage_passed and v.cluster_math_passed and v.group_partition_passed then true
        else false
    end as is_fully_verified,
    coalesce(a.accepted_events_count, 0) as accepted_events_count,
    coalesce(a.duplicate_attempts_count, 0) as duplicate_attempts_count,
    coalesce(a.conflict_attempts_count, 0) as conflict_attempts_count
from runs r
left join verifications v on r.analysis_run_id = v.analysis_run_id
left join audits a on r.analysis_run_id = a.analysis_run_id
