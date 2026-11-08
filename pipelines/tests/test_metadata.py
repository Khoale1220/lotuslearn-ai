import json
import os
from datetime import datetime, timezone
from pathlib import Path

import psycopg
import pytest
from psycopg.rows import dict_row

from lotuslearn_pipeline.metadata import (
    Asset,
    Field,
    MetadataSnapshot,
    build_metadata_snapshot,
    derive_asset_id,
    extract_dbt_metadata,
    extract_postgres_metadata,
    validate_metadata_snapshot,
)


def get_test_pg_url() -> str:
    for candidate in (
        os.environ.get("LOTUSLEARN_TEST_DATABASE_URL"),
        os.environ.get("LOTUSLEARN_DATABASE_URL"),
    ):
        if not candidate:
            continue
        try:
            with psycopg.connect(candidate, connect_timeout=2) as conn:
                conn.execute("SELECT 1;")
            return candidate
        except Exception:
            continue
    return ""


TEST_PG_URL = get_test_pg_url()


@pytest.fixture
def metadata_pg_conn():
    if not TEST_PG_URL:
        pytest.skip("PostgreSQL metadata integration test requires LOTUSLEARN_TEST_DATABASE_URL")

    with psycopg.connect(TEST_PG_URL, autocommit=True, row_factory=dict_row) as conn:
        conn.execute("DROP SCHEMA public CASCADE;")
        conn.execute("CREATE SCHEMA public;")
        yield conn


def test_derive_asset_id_is_stable_and_canonical():
    left = derive_asset_id("postgres", "analytics", "public", "student_enrollments")
    right = derive_asset_id("postgres", "analytics", "public", "student_enrollments")
    assert left == right
    assert left != derive_asset_id("postgres", "analytics", "public", "student")


def test_metadata_snapshot_round_trip_and_validation():
    asset_id = derive_asset_id("postgres", "analytics", "public", "student_enrollments")
    snapshot = MetadataSnapshot(
        extraction_sources=["postgres:canonical"],
        assets=[
            Asset(
                asset_id=asset_id,
                platform="postgres",
                database="analytics",
                schema="public",
                name="student_enrollments",
                asset_type="base_table",
                description="Student enrollment facts",
            )
        ],
        fields=[
            Field(
                asset_id=asset_id,
                field_name="student_id",
                ordinal_position=1,
                physical_data_type="bigint",
                normalized_type="bigint",
                nullable=False,
            )
        ],
    )

    dumped = snapshot.to_dict()
    restored = MetadataSnapshot.from_dict(dumped)
    assert restored.to_dict() == dumped
    assert validate_metadata_snapshot(restored).is_valid


def test_extract_postgres_metadata_discovers_table_view_and_materialized_view(metadata_pg_conn):
    with metadata_pg_conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE public.order_records (
                order_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                customer_id integer,
                total_amount numeric(12,2) DEFAULT 0,
                status text,
                created_at timestamptz default now(),
                order_payload jsonb
            );
            CREATE VIEW public.order_view AS
            SELECT order_id, customer_id FROM public.order_records;
            CREATE MATERIALIZED VIEW public.order_rollup AS
            SELECT customer_id, SUM(total_amount) AS total_amount
            FROM public.order_records GROUP BY customer_id;
            COMMENT ON TABLE public.order_records IS 'Order ledger';
            COMMENT ON COLUMN public.order_records.total_amount IS 'Total order value';
            """
        )

    assets, fields, _, _, errors = extract_postgres_metadata(metadata_pg_conn)
    names = {asset.name for asset in assets}
    assert {"order_records", "order_view", "order_rollup"}.issubset(names)
    order_asset = next(asset for asset in assets if asset.name == "order_records")
    assert order_asset.description == "Order ledger"
    field_map = {
        field.field_name: field for field in fields if field.asset_id == order_asset.asset_id
    }
    assert field_map["total_amount"].description == "Total order value"
    assert not errors


def test_extract_postgres_metadata_detects_primary_unique_and_foreign_key(metadata_pg_conn):
    with metadata_pg_conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE public.customer_accounts (
                customer_id integer PRIMARY KEY,
                email text UNIQUE NOT NULL,
                created_at timestamptz DEFAULT now(),
                profile jsonb DEFAULT '{}'::jsonb
            );
            CREATE TABLE public.customer_orders (
                order_id integer PRIMARY KEY,
                customer_id integer NOT NULL,
                order_status text NOT NULL,
                CONSTRAINT fk_customer_orders_customer
                    FOREIGN KEY (customer_id) REFERENCES public.customer_accounts(customer_id)
                    ON UPDATE CASCADE
                    ON DELETE RESTRICT
            );
            """
        )

    _, _, constraints, _, errors = extract_postgres_metadata(metadata_pg_conn)
    constraint_types = {constraint.constraint_type for constraint in constraints}
    assert "PRIMARY KEY" in constraint_types
    assert "UNIQUE" in constraint_types
    assert "FOREIGN KEY" in constraint_types
    fk_constraint = next(
        constraint for constraint in constraints if constraint.constraint_type == "FOREIGN KEY"
    )
    assert fk_constraint.constrained_fields == ("customer_id",)
    assert fk_constraint.referenced_fields == ("customer_id",)
    assert fk_constraint.update_rule == "CASCADE"
    assert fk_constraint.delete_rule == "RESTRICT"
    assert not errors


def test_extract_postgres_metadata_preserves_composite_fk_positional_mapping(metadata_pg_conn):
    with metadata_pg_conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE public.course_catalog (
                course_code text NOT NULL,
                school_year integer NOT NULL,
                title text,
                PRIMARY KEY (course_code, school_year)
            );
            CREATE TABLE public.student_enrollments (
                student_id integer NOT NULL,
                course_code text NOT NULL,
                school_year integer NOT NULL,
                enrollment_status text DEFAULT 'active',
                CONSTRAINT fk_enrollment_course
                    FOREIGN KEY (course_code, school_year)
                    REFERENCES public.course_catalog(course_code, school_year)
                    ON UPDATE CASCADE
                    ON DELETE RESTRICT
            );
            """
        )

    _, _, constraints, _, errors = extract_postgres_metadata(metadata_pg_conn)
    fk_constraint = next(
        constraint
        for constraint in constraints
        if constraint.constraint_type == "FOREIGN KEY"
        and constraint.constraint_name == "fk_enrollment_course"
    )
    assert fk_constraint.constrained_fields == ("course_code", "school_year")
    assert fk_constraint.referenced_fields == ("course_code", "school_year")
    assert fk_constraint.update_rule == "CASCADE"
    assert fk_constraint.delete_rule == "RESTRICT"
    assert not errors


def test_extract_postgres_metadata_detects_comments_nullable_defaults_and_types(metadata_pg_conn):
    with metadata_pg_conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE public.record_events (
                event_id serial PRIMARY KEY,
                event_name text NOT NULL,
                metadata jsonb DEFAULT '{}'::jsonb,
                created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
                is_active boolean,
                notes text NULL,
                row_count bigint DEFAULT 0
            );
            COMMENT ON TABLE public.record_events IS 'Operational event log';
            COMMENT ON COLUMN public.record_events.event_name IS 'Event label';
            """
        )

    assets, fields, _, _, errors = extract_postgres_metadata(metadata_pg_conn)
    event_table = next(asset for asset in assets if asset.name == "record_events")
    assert event_table.description == "Operational event log"
    field_map = {
        field.field_name: field for field in fields if field.asset_id == event_table.asset_id
    }
    assert field_map["event_name"].description == "Event label"
    assert field_map["metadata"].physical_data_type == "jsonb"
    assert field_map["created_at"].physical_data_type == "timestamp with time zone"
    assert field_map["notes"].nullable is True
    assert field_map["row_count"].default_expression == "0"
    assert not errors


def test_extract_postgres_metadata_stable_asset_id(metadata_pg_conn):
    with metadata_pg_conn.cursor() as cur:
        cur.execute(
            "CREATE TABLE public.asset_identity_demo (pk integer PRIMARY KEY, payload text);"
        )

    assets, _, _, _, errors = extract_postgres_metadata(metadata_pg_conn)
    asset = next(item for item in assets if item.name == "asset_identity_demo")
    assert asset.asset_id == derive_asset_id(
        "postgres", metadata_pg_conn.info.dbname, "public", "asset_identity_demo"
    )
    assert not errors


def test_extract_dbt_metadata_uses_manifest_assets_and_lineage():
    repo_root = Path(__file__).resolve().parents[2]
    manifest_path = repo_root / "analytics" / "target" / "manifest.json"
    assets, fields, _, lineage_edges, _, warnings, errors = extract_dbt_metadata(manifest_path)
    assert assets
    assert fields
    assert lineage_edges
    assert any(asset.name == "fct_teacher_decisions" for asset in assets)
    assert any(edge.edge_type == "dbt_parent" for edge in lineage_edges)
    assert not errors


def test_dbt_metadata_extracts_source_aliases_descriptions_and_materialization():
    repo_root = Path(__file__).resolve().parents[2]
    manifest_path = repo_root / "analytics" / "target" / "manifest.json"
    assets, fields, _, _, _, _, errors = extract_dbt_metadata(manifest_path)

    model_asset = next(
        asset
        for asset in assets
        if asset.dbt_unique_id == "model.lotuslearn_analytics.fct_teacher_decisions"
    )
    assert model_asset.database == "lotuslearn_dev"
    assert model_asset.schema == "analytics_marts"
    assert model_asset.name == "fct_teacher_decisions"
    assert model_asset.materialization == "table"
    assert "educator review actions" in (model_asset.description or "")
    assert any(field.asset_id == model_asset.asset_id and field.dbt_description for field in fields)
    source_asset = next(asset for asset in assets if asset.dbt_unique_id.startswith("source."))
    assert source_asset.dbt_resource_type == "source"
    assert not errors


def test_dbt_metadata_duplicate_lineage_suppression_and_custom_manifest(tmp_path):
    manifest = {
        "metadata": {"dbt_schema_version": "https://schemas.getdbt.com/dbt/manifest/v12.json"},
        "nodes": {
            "model.test.project.dim_customers": {
                "database": "analytics",
                "schema": "mart",
                "name": "dim_customers",
                "alias": "dim_customers",
                "resource_type": "model",
                "description": "Customer dimension",
                "config": {"materialized": "table"},
                "columns": {"customer_id": {"description": "Customer id", "data_type": "integer"}},
                "unique_id": "model.test.project.dim_customers",
            },
            "model.test.project.fct_orders": {
                "database": "analytics",
                "schema": "mart",
                "name": "fct_orders",
                "alias": "fct_orders",
                "resource_type": "model",
                "description": "Orders fact",
                "config": {"materialized": "table"},
                "columns": {"order_id": {"description": "Order id", "data_type": "integer"}},
                "unique_id": "model.test.project.fct_orders",
            },
        },
        "sources": {
            "source.test.project.raw.orders": {
                "database": "analytics",
                "schema": "raw",
                "name": "orders",
                "resource_type": "source",
                "description": "Raw orders",
                "columns": {"order_id": {"description": "Order id", "data_type": "integer"}},
                "unique_id": "source.test.project.raw.orders",
            }
        },
        "parent_map": {
            "model.test.project.dim_customers": ["source.test.project.raw.orders"],
            "model.test.project.fct_orders": [
                "source.test.project.raw.orders",
                "source.test.project.raw.orders",
            ],
        },
    }
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    assets, _, _, lineage_edges, _, _, errors = extract_dbt_metadata(manifest_path)
    edge_keys = {(edge.source_asset, edge.target_asset, edge.edge_type) for edge in lineage_edges}
    assert len(edge_keys) == 2
    assert any(asset.name == "orders" for asset in assets)
    assert not errors


def test_dbt_metadata_handles_malformed_manifest_and_unsupported_artifact_version(tmp_path):
    bad_manifest = tmp_path / "bad.json"
    bad_manifest.write_text("{not valid json}", encoding="utf-8")
    with pytest.raises(ValueError):
        extract_dbt_metadata(bad_manifest)

    unsupported = {
        "metadata": {"dbt_schema_version": "https://schemas.getdbt.com/dbt/manifest/v99.json"},
        "nodes": {},
        "sources": {},
        "parent_map": {},
    }
    manifest = tmp_path / "unsupported_manifest.json"
    manifest.write_text(json.dumps(unsupported), encoding="utf-8")
    _, _, _, _, _, warnings, errors = extract_dbt_metadata(manifest)
    assert any("Unrecognized dbt manifest schema version" in warning for warning in warnings)
    assert not errors


def test_checksum_identical_semantic_metadata_has_identical_checksum():
    asset = Asset(
        derive_asset_id("postgres", "analytics", "public", "orders"),
        "postgres",
        "analytics",
        "public",
        "orders",
        "base_table",
    )
    field = Field(
        derive_asset_id("postgres", "analytics", "public", "orders"),
        "order_id",
        1,
        "integer",
        "integer",
        False,
    )
    snapshot_a = MetadataSnapshot(assets=[asset], fields=[field])
    snapshot_b = MetadataSnapshot(assets=[asset], fields=[field])
    assert snapshot_a.compute_checksum() == snapshot_b.compute_checksum()


def test_checksum_ignores_generated_at_and_run_id():
    same = [
        Asset(
            derive_asset_id("postgres", "analytics", "public", "orders"),
            "postgres",
            "analytics",
            "public",
            "orders",
            "base_table",
        )
    ]
    snapshot_a = MetadataSnapshot(
        snapshot_id="a",
        generated_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        assets=same,
    )
    snapshot_b = MetadataSnapshot(
        snapshot_id="b",
        generated_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
        assets=same,
    )
    assert snapshot_a.compute_checksum() == snapshot_b.compute_checksum()


def test_checksum_ordering_does_not_create_drift():
    asset_one = Asset(
        derive_asset_id("postgres", "analytics", "public", "orders"),
        "postgres",
        "analytics",
        "public",
        "orders",
        "base_table",
    )
    asset_two = Asset(
        derive_asset_id("postgres", "analytics", "public", "customers"),
        "postgres",
        "analytics",
        "public",
        "customers",
        "base_table",
    )
    snapshot_a = MetadataSnapshot(assets=[asset_one, asset_two])
    snapshot_b = MetadataSnapshot(assets=[asset_two, asset_one])
    assert snapshot_a.compute_checksum() == snapshot_b.compute_checksum()


def test_checksum_change_detects_semantic_metadata_change():
    asset_a = Asset(
        derive_asset_id("postgres", "analytics", "public", "orders"),
        "postgres",
        "analytics",
        "public",
        "orders",
        "base_table",
    )
    asset_b = Asset(
        derive_asset_id("postgres", "analytics", "public", "orders"),
        "postgres",
        "analytics",
        "public",
        "orders",
        "view",
    )
    snapshot_a = MetadataSnapshot(assets=[asset_a])
    snapshot_b = MetadataSnapshot(assets=[asset_b])
    assert snapshot_a.compute_checksum() != snapshot_b.compute_checksum()


def test_checksum_round_trip_preserves_checksum_and_tampering_fails_validation():
    snapshot = MetadataSnapshot(
        assets=[
            Asset(
                derive_asset_id("postgres", "analytics", "public", "orders"),
                "postgres",
                "analytics",
                "public",
                "orders",
                "base_table",
            )
        ]
    )
    round_trip = MetadataSnapshot.from_dict(snapshot.to_dict())
    assert round_trip.compute_checksum() == snapshot.compute_checksum()

    tampered = MetadataSnapshot.from_dict(snapshot.to_dict())
    tampered.assets[0] = Asset(
        derive_asset_id("postgres", "analytics", "public", "orders"),
        "postgres",
        "analytics",
        "public",
        "orders",
        "view",
    )
    tampered.content_checksum = "broken-checksum"
    result = validate_metadata_snapshot(tampered)
    assert not result.is_valid
    assert any("Content checksum drift detected" in error for error in result.errors)


def test_validate_metadata_snapshot_rejects_known_structural_failures():
    asset_id = derive_asset_id("postgres", "analytics", "public", "orders")
    bad = MetadataSnapshot(
        assets=[
            Asset(asset_id, "postgres", "analytics", "public", "orders", "base_table"),
            Asset(asset_id, "postgres", "analytics", "public", "orders", "base_table"),
        ],
        fields=[
            Field(asset_id, "order_id", 0, "integer", "integer", False),
            Field(asset_id, "order_id", 1, "integer", "integer", False),
        ],
        constraints=[
            type(
                "C",
                (),
                {
                    "constraint_name": "bad_constraint",
                    "constraint_type": "FOREIGN KEY",
                    "owning_asset": "missing-asset",
                    "constrained_fields": ("x",),
                    "referenced_asset": "missing-asset",
                    "referenced_fields": ("y",),
                    "update_rule": None,
                    "delete_rule": None,
                    "deferrable": None,
                    "initially_deferred": None,
                    "enforced": True,
                },
            )(),
        ],
        lineage_edges=[
            type(
                "E",
                (),
                {
                    "source_asset": "missing-source",
                    "target_asset": "missing-target",
                    "edge_type": "dbt_parent",
                    "transformation_owner": None,
                    "evidence_source": None,
                    "source_fields": (),
                    "target_fields": (),
                },
            )(),
        ],
    )
    validation = validate_metadata_snapshot(bad)
    assert not validation.is_valid
    assert any("Duplicate asset IDs" in error for error in validation.errors)
    assert any("Duplicate field identity" in error for error in validation.errors)
    assert any("Invalid ordinal position" in error for error in validation.errors)
    assert any("Constraint references missing owning asset" in error for error in validation.errors)
    assert any("Lineage edge references missing asset" in error for error in validation.errors)


def test_validate_metadata_snapshot_rejects_unsupported_schema_and_checksum_drift():
    snapshot = MetadataSnapshot(schema_version="2.0.0")
    snapshot.content_checksum = "mutable"
    validation = validate_metadata_snapshot(snapshot)
    assert not validation.is_valid
    assert any("Unsupported metadata schema version" in error for error in validation.errors)
    assert any("Content checksum drift detected" in error for error in validation.errors)


def test_security_redacts_database_url_and_secret_values():
    secret_url = "postgresql://lotuslearn:supersecret@db.local:5432/lotuslearn_test"
    snapshot = MetadataSnapshot(
        extraction_sources=[secret_url],
        warnings=["password=supersecret"],
        errors=["api_key=abc123"],
        assets=[
            Asset(
                derive_asset_id("postgres", "analytics", "public", "student_records"),
                "postgres",
                "analytics",
                "public",
                "student_records",
                "base_table",
            )
        ],
    )
    serialized = json.dumps(snapshot.to_dict(), sort_keys=True)
    assert "supersecret" not in serialized
    assert "***" in serialized or "db.local" in serialized

    validation = validate_metadata_snapshot(snapshot)
    assert not validation.is_valid
    textual = "\n".join(validation.errors)
    assert "supersecret" not in textual
    assert "abc123" not in textual


def test_security_does_not_serialize_student_row_pii(metadata_pg_conn):
    with metadata_pg_conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE public.student_records (
                student_id integer PRIMARY KEY,
                student_name text,
                email text,
                raw_student text,
                analysis_notes text
            );
            INSERT INTO public.student_records (
                student_id,
                student_name,
                email,
                raw_student,
                analysis_notes
            )
            VALUES (
                1,
                'Alice Smith',
                'alice@example.com',
                'Alice was confused',
                'Needs support'
            );
            """
        )

    snapshot = build_metadata_snapshot(conn=metadata_pg_conn)
    payload = json.dumps(snapshot.to_dict(), sort_keys=True)
    assert "Alice Smith" not in payload
    assert "alice@example.com" not in payload
    assert "raw_student" not in payload
    assert not validate_metadata_snapshot(snapshot).is_valid


def test_extract_dbt_metadata_with_manifest_file_and_snapshot_round_trip():
    manifest_path = Path(__file__).resolve().parents[2] / "analytics" / "target" / "manifest.json"
    snapshot = build_metadata_snapshot(manifest_path=manifest_path)
    assert snapshot.assets
    assert snapshot.content_checksum
    restored = MetadataSnapshot.from_dict(snapshot.to_dict())
    assert restored.content_checksum == snapshot.content_checksum
