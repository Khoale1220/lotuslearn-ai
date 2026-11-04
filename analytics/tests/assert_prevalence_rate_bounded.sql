-- Asserts that prevalence_rate in fct_misconception_clusters is strictly between 0.0 and 1.0 inclusive
select
    analysis_run_id,
    cluster_id,
    prevalence_rate
from {{ ref('fct_misconception_clusters') }}
where prevalence_rate < 0.0 or prevalence_rate > 1.0
