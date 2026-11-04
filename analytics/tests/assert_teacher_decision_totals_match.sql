-- Asserts that sum of accepted, edited, and dismissed decisions equals total_decisions_reviewed
select
    analysis_run_id,
    count_decisions_accepted,
    count_decisions_edited,
    count_decisions_dismissed,
    total_decisions_reviewed
from {{ ref('fct_analysis_runs') }}
where (count_decisions_accepted + count_decisions_edited + count_decisions_dismissed) != total_decisions_reviewed
