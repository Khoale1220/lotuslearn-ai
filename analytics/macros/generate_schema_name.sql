{# Macro to configure custom schema naming in PostgreSQL #}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- set default_schema = target.schema -%}
    {%- if env_var('DBT_FLAT_SCHEMA', 'false') == 'true' -%}
        {{ default_schema }}
    {%- elif custom_schema_name is none -%}
        {{ default_schema }}
    {%- else -%}
        {{ default_schema }}_{{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
