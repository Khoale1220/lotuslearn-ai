{{ config(materialized='view') }}

-- Grain: one row per committed analytical event envelope
SELECT
    CAST(event_id AS TEXT) AS event_id,
    CAST(schema_version AS TEXT) AS schema_version,
    CAST(event_type AS TEXT) AS event_type,
    CAST(occurred_at AS TIMESTAMPTZ) AS occurred_at,
    CAST(analysis_run_id AS TEXT) AS analysis_run_id,
    CAST(provenance AS TEXT) AS provenance,
    payload_json
FROM {{ source('lotuslearn_operational', 'analytical_events') }}
