-- Asserts zero PII exists across text fields in analytical marts (email pattern check)
select
    analysis_run_id,
    cluster_id,
    concept,
    explanation
from {{ ref('fct_misconception_clusters') }}
where explanation ~* '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
   or explanation ~* '\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'
