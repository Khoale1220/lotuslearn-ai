with clusters as (
    select * from {{ ref('stg_misconception_clusters') }}
),

runs as (
    select * from {{ ref('stg_analysis_runs') }}
),

findings as (
    select
        analysis_run_id,
        cluster_id,
        count(distinct student_id)::integer as verified_finding_students_count
    from {{ ref('stg_student_findings') }}
    group by analysis_run_id, cluster_id
)

select
    c.analysis_run_id,
    c.cluster_id,
    c.concept,
    c.teaching_priority,
    c.affected_student_count as affected_students,
    r.submission_count as total_students,
    coalesce(f.verified_finding_students_count, 0) as verified_finding_students_count,
    round(
        cast(cast(c.affected_student_count as real) / cast(r.submission_count as real) as numeric),
        4
    ) as prevalence_rate,
    c.percentage_affected,
    c.explanation
from clusters c
join runs r on c.analysis_run_id = r.analysis_run_id
left join findings f
    on c.analysis_run_id = f.analysis_run_id
    and c.cluster_id = f.cluster_id
