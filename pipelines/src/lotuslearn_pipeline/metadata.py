"""Canonical metadata graph extraction for PostgreSQL and dbt assets."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import uuid
from dataclasses import dataclass
from dataclasses import field as dataclass_field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlsplit, urlunsplit

import psycopg
from psycopg.rows import dict_row

SUPPORTED_SCHEMA_VERSIONS = {"1.0.0"}
SUPPORTED_DBT_ARTIFACT_SCHEMAS = {
    "https://schemas.getdbt.com/dbt/manifest/v12.json",
    "https://schemas.getdbt.com/dbt/manifest/v11.json",
    "https://schemas.getdbt.com/dbt/manifest/v10.json",
}
PROHIBITED_METADATA_TOKENS = (
    "password",
    "passwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "access_token",
    "connection_string",
    "database_url",
)
PROHIBITED_PII_TOKENS = (
    "student_name",
    "full_name",
    "raw_student",
    "student_text",
    "submission_text",
    "uploaded_image",
)


def _safe_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _redact_sensitive_value(value: Any) -> str:
    text = str(value or "")
    lowered = text.lower()
    if any(token in lowered for token in PROHIBITED_METADATA_TOKENS):
        return "<redacted>"
    if any(token in lowered for token in PROHIBITED_PII_TOKENS):
        return "<redacted>"
    return text


def _sanitize_for_validation(value: Any) -> Any:
    sanitized = _sanitize_metadata_serialization(value)
    if isinstance(sanitized, (list, tuple)):
        return [str(item) for item in sanitized]
    if isinstance(sanitized, dict):
        return {str(key): str(val) for key, val in sanitized.items()}
    return str(sanitized) if sanitized is not None else ""


def _sanitize_metadata_serialization(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, list):
        return [_sanitize_metadata_serialization(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_sanitize_metadata_serialization(item) for item in value)
    if isinstance(value, dict):
        return {str(key): _sanitize_metadata_serialization(val) for key, val in value.items()}
    if isinstance(value, str):
        if "://" in value and "@" in value:
            return _sanitize_database_url(value) or "<redacted>"
        return _redact_sensitive_value(value)
    return value


def _sanitize_database_url(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return text
    try:
        parsed = urlsplit(text)
        if parsed.scheme and parsed.hostname:
            username = parsed.username or "user"
            host = parsed.hostname
            if parsed.port:
                host = f"{host}:{parsed.port}"
            if parsed.password is not None:
                netloc = f"{username}:***@{host}"
            elif parsed.username is not None:
                netloc = f"{username}@{host}"
            else:
                netloc = host
            rebuilt = parsed._replace(netloc=netloc)
            return urlunsplit(rebuilt)
    except Exception:
        pass
    return re.sub(r"(?<=://)([^@\s:]+:)([^@\s]+)(?=@)", r"\1***", text)


def _canonical_relation_key(
    platform: str, database: Optional[str], schema: Optional[str], name: str
) -> str:
    return _safe_json(
        {
            "platform": platform,
            "database": database or "",
            "schema": schema or "",
            "name": name,
        }
    )


def _to_jsonable_dict(value: Any) -> Dict[str, Any]:
    if hasattr(value, "to_dict"):
        data = value.to_dict()
        if isinstance(data, dict):
            return data
    if isinstance(value, dict):
        return dict(value)
    keys = [
        "asset_id",
        "platform",
        "database",
        "schema",
        "name",
        "asset_type",
        "field_name",
        "ordinal_position",
        "physical_data_type",
        "normalized_type",
        "nullable",
        "default_expression",
        "description",
        "dbt_description",
        "constraint_name",
        "constraint_type",
        "owning_asset",
        "constrained_fields",
        "referenced_asset",
        "referenced_fields",
        "update_rule",
        "delete_rule",
        "deferrable",
        "initially_deferred",
        "enforced",
        "source_asset",
        "target_asset",
        "edge_type",
        "transformation_owner",
        "evidence_source",
        "source_fields",
        "target_fields",
    ]
    payload: Dict[str, Any] = {}
    for key in keys:
        if hasattr(value, key):
            payload[key] = getattr(value, key)
    return payload


def derive_asset_id(
    platform: str, database: Optional[str], schema: Optional[str], name: str
) -> str:
    """Return a stable asset identity derived from logical relation identity."""
    return hashlib.sha256(
        _canonical_relation_key(platform, database, schema, name).encode("utf-8")
    ).hexdigest()


def normalize_identifier(value: Optional[str], *, preserve_case: bool = True) -> Optional[str]:
    if value is None:
        return None
    value = str(value).strip()
    if not value:
        return None
    return value if preserve_case else value.lower()


@dataclass(frozen=True)
class Asset:
    asset_id: str
    platform: str
    database: Optional[str]
    schema: Optional[str]
    name: str
    asset_type: str
    description: Optional[str] = None
    owner: Optional[str] = None
    dbt_unique_id: Optional[str] = None
    dbt_resource_type: Optional[str] = None
    materialization: Optional[str] = None
    source_file: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Asset":
        return cls(
            asset_id=str(data["asset_id"]),
            platform=str(data.get("platform") or "unknown"),
            database=data.get("database"),
            schema=data.get("schema"),
            name=str(data["name"]),
            asset_type=str(data.get("asset_type") or "unknown"),
            description=data.get("description"),
            owner=data.get("owner"),
            dbt_unique_id=data.get("dbt_unique_id"),
            dbt_resource_type=data.get("dbt_resource_type"),
            materialization=data.get("materialization"),
            source_file=data.get("source_file"),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "asset_id": self.asset_id,
            "platform": self.platform,
            "database": self.database,
            "schema": self.schema,
            "name": self.name,
            "asset_type": self.asset_type,
            "description": self.description,
            "owner": self.owner,
            "dbt_unique_id": self.dbt_unique_id,
            "dbt_resource_type": self.dbt_resource_type,
            "materialization": self.materialization,
            "source_file": self.source_file,
        }


@dataclass(frozen=True)
class Field:
    asset_id: str
    field_name: str
    ordinal_position: Optional[int] = None
    physical_data_type: Optional[str] = None
    normalized_type: Optional[str] = None
    nullable: Optional[bool] = None
    default_expression: Optional[str] = None
    description: Optional[str] = None
    dbt_description: Optional[str] = None

    @property
    def identity(self) -> str:
        return f"{self.asset_id}:{self.field_name}"

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Field":
        return cls(
            asset_id=str(data["asset_id"]),
            field_name=str(data["field_name"]),
            ordinal_position=data.get("ordinal_position"),
            physical_data_type=data.get("physical_data_type"),
            normalized_type=data.get("normalized_type"),
            nullable=data.get("nullable"),
            default_expression=data.get("default_expression"),
            description=data.get("description"),
            dbt_description=data.get("dbt_description"),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "asset_id": self.asset_id,
            "field_name": self.field_name,
            "ordinal_position": self.ordinal_position,
            "physical_data_type": self.physical_data_type,
            "normalized_type": self.normalized_type,
            "nullable": self.nullable,
            "default_expression": self.default_expression,
            "description": self.description,
            "dbt_description": self.dbt_description,
        }


@dataclass(frozen=True)
class Constraint:
    constraint_name: str
    constraint_type: str
    owning_asset: str
    constrained_fields: Tuple[str, ...]
    referenced_asset: Optional[str] = None
    referenced_fields: Tuple[str, ...] = ()
    update_rule: Optional[str] = None
    delete_rule: Optional[str] = None
    deferrable: Optional[bool] = None
    initially_deferred: Optional[bool] = None
    enforced: Optional[bool] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Constraint":
        return cls(
            constraint_name=str(data["constraint_name"]),
            constraint_type=str(data["constraint_type"]),
            owning_asset=str(data["owning_asset"]),
            constrained_fields=tuple(data.get("constrained_fields") or ()),
            referenced_asset=data.get("referenced_asset"),
            referenced_fields=tuple(data.get("referenced_fields") or ()),
            update_rule=data.get("update_rule"),
            delete_rule=data.get("delete_rule"),
            deferrable=data.get("deferrable"),
            initially_deferred=data.get("initially_deferred"),
            enforced=data.get("enforced"),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "constraint_name": self.constraint_name,
            "constraint_type": self.constraint_type,
            "owning_asset": self.owning_asset,
            "constrained_fields": list(self.constrained_fields),
            "referenced_asset": self.referenced_asset,
            "referenced_fields": list(self.referenced_fields),
            "update_rule": self.update_rule,
            "delete_rule": self.delete_rule,
            "deferrable": self.deferrable,
            "initially_deferred": self.initially_deferred,
            "enforced": self.enforced,
        }


@dataclass(frozen=True)
class LineageEdge:
    source_asset: str
    target_asset: str
    edge_type: str
    transformation_owner: Optional[str] = None
    evidence_source: Optional[str] = None
    source_fields: Tuple[str, ...] = ()
    target_fields: Tuple[str, ...] = ()

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LineageEdge":
        return cls(
            source_asset=str(data["source_asset"]),
            target_asset=str(data["target_asset"]),
            edge_type=str(data["edge_type"]),
            transformation_owner=data.get("transformation_owner"),
            evidence_source=data.get("evidence_source"),
            source_fields=tuple(data.get("source_fields") or ()),
            target_fields=tuple(data.get("target_fields") or ()),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_asset": self.source_asset,
            "target_asset": self.target_asset,
            "edge_type": self.edge_type,
            "transformation_owner": self.transformation_owner,
            "evidence_source": self.evidence_source,
            "source_fields": list(self.source_fields),
            "target_fields": list(self.target_fields),
        }


@dataclass
class ExtractionRun:
    run_id: str
    start_time: datetime
    completion_time: datetime
    status: str
    extraction_counts: Dict[str, int] = dataclass_field(default_factory=dict)
    warnings: List[str] = dataclass_field(default_factory=list)
    errors: List[str] = dataclass_field(default_factory=list)
    source_versions: Dict[str, str] = dataclass_field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExtractionRun":
        return cls(
            run_id=str(data["run_id"]),
            start_time=datetime.fromisoformat(data["start_time"]),
            completion_time=datetime.fromisoformat(data["completion_time"]),
            status=str(data["status"]),
            extraction_counts=dict(data.get("extraction_counts") or {}),
            warnings=list(data.get("warnings") or []),
            errors=list(data.get("errors") or []),
            source_versions=dict(data.get("source_versions") or {}),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "start_time": self.start_time.isoformat(),
            "completion_time": self.completion_time.isoformat(),
            "status": self.status,
            "extraction_counts": dict(self.extraction_counts),
            "warnings": list(self.warnings),
            "errors": list(self.errors),
            "source_versions": dict(self.source_versions),
        }


@dataclass
class MetadataSnapshot:
    schema_version: str = "1.0.0"
    snapshot_id: str = dataclass_field(default_factory=lambda: uuid.uuid4().hex)
    generated_at: datetime = dataclass_field(default_factory=lambda: datetime.now(timezone.utc))
    extractor_version: str = "lotuslearn-pipeline/0.1.0"
    repository_commit: Optional[str] = None
    postgres_server_version: Optional[str] = None
    dbt_version: Optional[str] = None
    dbt_artifact_schema_version: Optional[str] = None
    extraction_sources: List[str] = dataclass_field(default_factory=list)
    assets: List[Asset] = dataclass_field(default_factory=list)
    fields: List[Field] = dataclass_field(default_factory=list)
    constraints: List[Constraint] = dataclass_field(default_factory=list)
    lineage_edges: List[LineageEdge] = dataclass_field(default_factory=list)
    warnings: List[str] = dataclass_field(default_factory=list)
    errors: List[str] = dataclass_field(default_factory=list)
    run: Optional[ExtractionRun] = None
    content_checksum: str = ""
    asset_count: int = 0
    field_count: int = 0
    constraint_count: int = 0
    lineage_edge_count: int = 0
    warning_count: int = 0
    error_count: int = 0

    def __post_init__(self) -> None:
        self.recalculate_counts()
        self.content_checksum = self.compute_checksum()

    def recalculate_counts(self) -> None:
        self.asset_count = len(self.assets)
        self.field_count = len(self.fields)
        self.constraint_count = len(self.constraints)
        self.lineage_edge_count = len(self.lineage_edges)
        self.warning_count = len(self.warnings)
        self.error_count = len(self.errors)

    def _checksum_payload(self) -> Dict[str, Any]:
        payload = {
            "schema_version": self.schema_version,
            "extractor_version": self.extractor_version,
            "repository_commit": self.repository_commit,
            "postgres_server_version": self.postgres_server_version,
            "dbt_version": self.dbt_version,
            "dbt_artifact_schema_version": self.dbt_artifact_schema_version,
            "assets": [
                _to_jsonable_dict(asset)
                for asset in sorted(
                    self.assets,
                    key=lambda a: (a.platform, a.database or "", a.schema or "", a.name),
                )
            ],
            "fields": [
                _to_jsonable_dict(field)
                for field in sorted(self.fields, key=lambda f: (f.asset_id, f.field_name))
            ],
            "constraints": [
                _to_jsonable_dict(constraint)
                for constraint in sorted(
                    self.constraints,
                    key=lambda c: (c.owning_asset, c.constraint_name, c.constraint_type),
                )
            ],
            "lineage_edges": [
                _to_jsonable_dict(edge)
                for edge in sorted(
                    self.lineage_edges, key=lambda e: (e.source_asset, e.target_asset, e.edge_type)
                )
            ],
            "warnings": sorted(self.warnings),
            "errors": sorted(self.errors),
        }
        return _sanitize_metadata_serialization(payload)

    def compute_checksum(self) -> str:
        payload = self._checksum_payload()
        return hashlib.sha256(_safe_json(payload).encode("utf-8")).hexdigest()

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MetadataSnapshot":
        run = data.get("run")
        snapshot = cls(
            schema_version=str(data.get("schema_version") or "1.0.0"),
            snapshot_id=str(data.get("snapshot_id") or uuid.uuid4().hex),
            generated_at=datetime.fromisoformat(
                str(data.get("generated_at") or datetime.now(timezone.utc).isoformat())
            ),
            extractor_version=str(data.get("extractor_version") or "lotuslearn-pipeline/0.1.0"),
            repository_commit=data.get("repository_commit"),
            postgres_server_version=data.get("postgres_server_version"),
            dbt_version=data.get("dbt_version"),
            dbt_artifact_schema_version=data.get("dbt_artifact_schema_version"),
            extraction_sources=list(data.get("extraction_sources") or []),
            assets=[Asset.from_dict(item) for item in data.get("assets") or []],
            fields=[Field.from_dict(item) for item in data.get("fields") or []],
            constraints=[Constraint.from_dict(item) for item in data.get("constraints") or []],
            lineage_edges=[LineageEdge.from_dict(item) for item in data.get("lineage_edges") or []],
            warnings=list(data.get("warnings") or []),
            errors=list(data.get("errors") or []),
            run=ExtractionRun.from_dict(run) if run else None,
            content_checksum=str(data.get("content_checksum") or ""),
            asset_count=int(data.get("asset_count") or 0),
            field_count=int(data.get("field_count") or 0),
            constraint_count=int(data.get("constraint_count") or 0),
            lineage_edge_count=int(data.get("lineage_edge_count") or 0),
            warning_count=int(data.get("warning_count") or 0),
            error_count=int(data.get("error_count") or 0),
        )
        if not snapshot.content_checksum:
            snapshot.content_checksum = snapshot.compute_checksum()
        return snapshot

    def to_dict(self) -> Dict[str, Any]:
        data = {
            "schema_version": self.schema_version,
            "snapshot_id": self.snapshot_id,
            "generated_at": self.generated_at.isoformat(),
            "extractor_version": self.extractor_version,
            "repository_commit": self.repository_commit,
            "postgres_server_version": self.postgres_server_version,
            "dbt_version": self.dbt_version,
            "dbt_artifact_schema_version": self.dbt_artifact_schema_version,
            "extraction_sources": [
                _sanitize_database_url(value) or _redact_sensitive_value(value)
                for value in self.extraction_sources
            ],
            "assets": [asset.to_dict() for asset in self.assets],
            "fields": [field.to_dict() for field in self.fields],
            "constraints": [constraint.to_dict() for constraint in self.constraints],
            "lineage_edges": [edge.to_dict() for edge in self.lineage_edges],
            "warnings": [_redact_sensitive_value(value) for value in self.warnings],
            "errors": [_redact_sensitive_value(value) for value in self.errors],
            "content_checksum": self.content_checksum or self.compute_checksum(),
            "asset_count": self.asset_count,
            "field_count": self.field_count,
            "constraint_count": self.constraint_count,
            "lineage_edge_count": self.lineage_edge_count,
            "warning_count": self.warning_count,
            "error_count": self.error_count,
        }
        if self.run is not None:
            data["run"] = self.run.to_dict()
        return _sanitize_metadata_serialization(data)


@dataclass
class MetadataValidationResult:
    is_valid: bool
    warnings: List[str]
    errors: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "warnings": list(self.warnings),
            "errors": list(self.errors),
        }


def _detect_repository_commit(repo_root: Optional[Path] = None) -> Optional[str]:
    repo_root = repo_root or Path(__file__).resolve().parents[3]
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_root), "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip() or None
    except Exception:
        return None


def _detect_dbt_version() -> Optional[str]:
    try:
        import importlib.metadata

        for pkg_name in ("dbt-core", "dbt-postgres", "dbt"):
            try:
                return importlib.metadata.version(pkg_name)
            except importlib.metadata.PackageNotFoundError:
                continue
    except Exception:
        return None
    return None


def _flatten_unique_id(resource: Dict[str, Any]) -> str:
    return str(resource.get("unique_id") or resource.get("name") or "")


def _normalize_asset_name(name: Optional[str]) -> Optional[str]:
    if name is None:
        return None
    cleaned = str(name).strip()
    return cleaned or None


def _parse_dbt_relation(
    resource: Dict[str, Any],
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    database = normalize_identifier(resource.get("database"))
    schema = normalize_identifier(resource.get("schema"))
    alias = normalize_identifier(resource.get("alias"))
    name = normalize_identifier(resource.get("name"))
    identifier = normalize_identifier(resource.get("identifier"))
    relation_name = normalize_identifier(resource.get("relation_name"))

    if relation_name and "." in relation_name:
        parts = relation_name.split(".")
        if len(parts) == 3:
            database = database or parts[0]
            schema = schema or parts[1]
            name = name or parts[2]
        elif len(parts) == 2:
            schema = schema or parts[0]
            name = name or parts[1]

    if alias:
        name = alias
    elif identifier:
        name = identifier
    elif name is None:
        name = resource.get("name")

    return database, schema, name


def _dbt_asset_id_from_resource(resource: Dict[str, Any]) -> str:
    database, schema, name = _parse_dbt_relation(resource)
    if not name:
        raise ValueError(f"Unable to resolve dbt asset name for resource {resource!r}")
    return derive_asset_id("dbt", database, schema, name)


def extract_postgres_metadata(
    conn: psycopg.Connection,
) -> Tuple[List[Asset], List[Field], List[Constraint], List[str], List[str]]:
    """Extract a canonical PostgreSQL metadata model from PostgreSQL catalog metadata."""
    warnings: List[str] = []
    errors: List[str] = []
    database_name = conn.info.dbname or "unknown"
    assets: List[Asset] = []
    fields: List[Field] = []
    constraints: List[Constraint] = []

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT n.nspname AS table_schema,
                   c.relname AS table_name,
                   CASE c.relkind
                       WHEN 'r' THEN 'BASE TABLE'
                       WHEN 'v' THEN 'VIEW'
                       WHEN 'm' THEN 'MATERIALIZED VIEW'
                       ELSE 'TABLE'
                   END AS table_type
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
              AND c.relkind IN ('r', 'v', 'm')
            ORDER BY n.nspname, c.relname;
            """
        )
        tables = cur.fetchall()

        table_comments = {}
        cur.execute(
            """
            SELECT n.nspname AS table_schema, c.relname AS table_name,
                   pg_catalog.obj_description(c.oid, 'pg_class') AS table_comment
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY n.nspname, c.relname;
            """
        )
        for row in cur.fetchall():
            table_comments[(row["table_schema"], row["table_name"])] = row.get("table_comment")

        col_comments = {}
        cur.execute(
            """
            SELECT n.nspname AS table_schema, c.relname AS table_name, a.attname AS column_name,
                   pg_catalog.col_description(c.oid, a.attnum) AS column_comment
            FROM pg_catalog.pg_attribute a
            JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
              AND a.attnum > 0
              AND NOT a.attisdropped
            ORDER BY n.nspname, c.relname, a.attnum;
            """
        )
        for row in cur.fetchall():
            col_comments[(row["table_schema"], row["table_name"], row["column_name"])] = row.get(
                "column_comment"
            )

        cur.execute(
            """
            SELECT table_schema, table_name, column_name, ordinal_position, data_type,
                   is_nullable, column_default, udt_name
            FROM information_schema.columns
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY table_schema, table_name, ordinal_position;
            """
        )
        column_rows = cur.fetchall()

        columns_by_table: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
        for row in column_rows:
            columns_by_table.setdefault((row["table_schema"], row["table_name"]), []).append(
                dict(row)
            )

        for table in tables:
            schema_name = table["table_schema"]
            relation_name = table["table_name"]
            asset_id = derive_asset_id("postgres", database_name, schema_name, relation_name)
            asset_type = str(table["table_type"]).lower().replace(" ", "_")
            asset = Asset(
                asset_id=asset_id,
                platform="postgres",
                database=database_name,
                schema=schema_name,
                name=relation_name,
                asset_type=asset_type,
                description=table_comments.get((schema_name, relation_name)),
            )
            assets.append(asset)

            for column_row in columns_by_table.get((schema_name, relation_name), []):
                field_name = str(column_row["column_name"])
                data_type = str(
                    column_row.get("data_type") or column_row.get("udt_name") or "unknown"
                )
                default_expression = column_row.get("column_default")
                nullable = column_row.get("is_nullable") == "YES"
                if default_expression is not None and len(str(default_expression)) > 200:
                    default_expression = str(default_expression)[:200]
                field = Field(
                    asset_id=asset_id,
                    field_name=field_name,
                    ordinal_position=int(column_row["ordinal_position"]),
                    physical_data_type=data_type,
                    normalized_type=data_type,
                    nullable=nullable,
                    default_expression=default_expression,
                    description=col_comments.get((schema_name, relation_name, field_name)),
                )
                fields.append(field)

        cur.execute(
            """
            WITH constraint_details AS (
                SELECT n.nspname AS table_schema,
                       c.relname AS table_name,
                       con.conname AS constraint_name,
                       CASE con.contype
                           WHEN 'p' THEN 'PRIMARY KEY'
                           WHEN 'u' THEN 'UNIQUE'
                           WHEN 'f' THEN 'FOREIGN KEY'
                           ELSE 'CHECK'
                       END AS constraint_type,
                       con.condeferrable AS is_deferrable,
                       con.condeferred AS initially_deferred,
                       con.conenforced AS enforced,
                       refn.nspname AS ref_table_schema,
                       refc.relname AS ref_table_name,
                       CASE con.confupdtype
                           WHEN 'a' THEN 'NO ACTION'
                           WHEN 'r' THEN 'RESTRICT'
                           WHEN 'c' THEN 'CASCADE'
                           WHEN 'n' THEN 'SET NULL'
                           WHEN 'd' THEN 'SET DEFAULT'
                           ELSE NULL
                       END AS update_rule,
                       CASE con.confdeltype
                           WHEN 'a' THEN 'NO ACTION'
                           WHEN 'r' THEN 'RESTRICT'
                           WHEN 'c' THEN 'CASCADE'
                           WHEN 'n' THEN 'SET NULL'
                           WHEN 'd' THEN 'SET DEFAULT'
                           ELSE NULL
                       END AS delete_rule,
                       source_cols.constrained_fields,
                       ref_cols.referenced_fields
                FROM pg_catalog.pg_constraint con
                JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
                JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                LEFT JOIN pg_catalog.pg_class refc ON refc.oid = con.confrelid
                LEFT JOIN pg_catalog.pg_namespace refn ON refn.oid = refc.relnamespace
                LEFT JOIN LATERAL (
                    SELECT ARRAY_AGG(a.attname ORDER BY ord.ordinality) AS constrained_fields
                    FROM unnest(con.conkey) WITH ORDINALITY AS ord(colnum, ordinality)
                    JOIN pg_catalog.pg_attribute a
                      ON a.attrelid = con.conrelid
                     AND a.attnum = ord.colnum
                ) source_cols ON TRUE
                LEFT JOIN LATERAL (
                    SELECT ARRAY_AGG(a.attname ORDER BY ord.ordinality) AS referenced_fields
                    FROM unnest(
                        COALESCE(con.confkey, ARRAY[]::smallint[])
                    ) WITH ORDINALITY AS ord(colnum, ordinality)
                    JOIN pg_catalog.pg_attribute a
                      ON a.attrelid = con.confrelid
                     AND a.attnum = ord.colnum
                ) ref_cols ON TRUE
                WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                  AND con.contype IN ('p', 'u', 'f')
            )
            SELECT *
            FROM constraint_details
            ORDER BY table_schema, table_name, constraint_name;
            """
        )
        constraint_rows = cur.fetchall()

        for row in constraint_rows:
            constraint_type = str(row["constraint_type"])
            table_schema = str(row["table_schema"])
            table_name = str(row["table_name"])
            owning_asset_id = derive_asset_id("postgres", database_name, table_schema, table_name)
            referenced_asset_id = None
            if row.get("ref_table_name"):
                referenced_asset_id = derive_asset_id(
                    "postgres",
                    database_name,
                    row.get("ref_table_schema") or table_schema,
                    str(row["ref_table_name"]),
                )

            constrained_fields = tuple(row.get("constrained_fields") or ())
            referenced_fields = tuple(row.get("referenced_fields") or ())
            constraints.append(
                Constraint(
                    constraint_name=str(row["constraint_name"]),
                    constraint_type=constraint_type,
                    owning_asset=owning_asset_id,
                    constrained_fields=constrained_fields,
                    referenced_asset=referenced_asset_id,
                    referenced_fields=referenced_fields,
                    update_rule=row.get("update_rule"),
                    delete_rule=row.get("delete_rule"),
                    deferrable=row.get("is_deferrable") == "YES"
                    if row.get("is_deferrable") is not None
                    else None,
                    initially_deferred=row.get("initially_deferred") == "YES"
                    if row.get("initially_deferred") is not None
                    else None,
                    enforced=row.get("enforced") if row.get("enforced") is not None else True,
                )
            )
    for asset in assets:
        if any(token in asset.name.lower() for token in PROHIBITED_PII_TOKENS):
            errors.append("PII or sensitive metadata token detected in asset name.")

    for field in fields:
        if any(token in field.field_name.lower() for token in PROHIBITED_PII_TOKENS):
            errors.append("PII or sensitive metadata token detected in field name.")
        if any(
            token in (field.physical_data_type or "").lower()
            for token in PROHIBITED_METADATA_TOKENS
        ):
            errors.append("Secret-like metadata token detected in field type.")
    return assets, fields, constraints, warnings, errors


def extract_dbt_metadata(
    manifest_path: Path, catalog_path: Optional[Path] = None
) -> Tuple[
    List[Asset],
    List[Field],
    List[Constraint],
    List[LineageEdge],
    Dict[str, Any],
    List[str],
    List[str],
]:
    """Extract dbt metadata from dbt manifest and optional catalog metadata."""
    warnings: List[str] = []
    errors: List[str] = []
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest_version = str(manifest.get("metadata", {}).get("dbt_schema_version") or "unknown")
    if manifest_version not in SUPPORTED_DBT_ARTIFACT_SCHEMAS and manifest_version != "unknown":
        warnings.append(f"Unrecognized dbt manifest schema version: {manifest_version}")
    if manifest_version == "unknown":
        warnings.append("dbt manifest schema version missing; extraction remains best-effort.")

    catalog: Dict[str, Any] = {}
    if catalog_path is not None and catalog_path.exists():
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))

    assets: List[Asset] = []
    fields: List[Field] = []
    constraints: List[Constraint] = []
    lineage_edges: List[LineageEdge] = []
    asset_ids: Dict[str, str] = {}
    seen_edges: set[Tuple[str, str, str]] = set()

    resources = {}
    resources.update(manifest.get("nodes", {}))
    resources.update(manifest.get("sources", {}))

    for unique_id, resource in sorted(resources.items()):
        resource_type = str(resource.get("resource_type") or "unknown")
        if resource_type not in {
            "model",
            "source",
            "seed",
            "snapshot",
            "test",
            "exposure",
            "metric",
            "semantic_model",
        }:
            continue
        database, schema, name = _parse_dbt_relation(resource)
        if not name:
            warnings.append(
                "Skipping dbt resource "
                f"{unique_id} because no stable relation name could be resolved."
            )
            continue
        asset_id = derive_asset_id("dbt", database, schema, name)
        asset_ids[unique_id] = asset_id
        asset_type = "source" if resource_type == "source" else resource_type
        description = resource.get("description")
        materialization = None
        config = resource.get("config") or {}
        if isinstance(config, dict):
            materialization = config.get("materialized")
        source_file_value = resource.get("original_file_path") or resource.get("path")
        asset = Asset(
            asset_id=asset_id,
            platform="dbt",
            database=database,
            schema=schema,
            name=name,
            asset_type=asset_type,
            description=description,
            dbt_unique_id=unique_id,
            dbt_resource_type=resource_type,
            materialization=materialization,
            source_file=str(source_file_value) if source_file_value is not None else None,
        )
        assets.append(asset)

        columns = resource.get("columns") or {}
        for field_name, column in sorted(columns.items()):
            field_description = column.get("description")
            field = Field(
                asset_id=asset_id,
                field_name=str(field_name),
                ordinal_position=None,
                physical_data_type=str(column.get("data_type") or "unknown"),
                normalized_type=str(column.get("data_type") or "unknown"),
                nullable=None,
                description=field_description,
                dbt_description=field_description,
            )
            fields.append(field)

    parent_map = manifest.get("parent_map") or {}
    for child_unique_id, parent_unique_ids in sorted(parent_map.items()):
        child_asset_id = asset_ids.get(child_unique_id)
        if child_asset_id is None:
            continue
        for parent_unique_id in parent_unique_ids:
            parent_asset_id = asset_ids.get(parent_unique_id)
            if parent_asset_id is None:
                continue
            edge = LineageEdge(
                source_asset=parent_asset_id,
                target_asset=child_asset_id,
                edge_type="dbt_parent",
                transformation_owner="dbt",
                evidence_source="manifest.parent_map",
            )
            edge_key = (edge.source_asset, edge.target_asset, edge.edge_type)
            if edge_key not in seen_edges:
                seen_edges.add(edge_key)
                lineage_edges.append(edge)

    for node in resources.values():
        if not isinstance(node, dict):
            continue
        unique_id = _flatten_unique_id(node)
        if not unique_id or unique_id not in asset_ids:
            continue
        dbt_constraints = node.get("constraints") or []
        for constraint in dbt_constraints:
            if not isinstance(constraint, dict):
                continue
            name = str(constraint.get("name") or f"{unique_id}_constraint")
            ctype = str(constraint.get("type") or "unknown")
            fields_list = tuple(sorted((str(k) for k in constraint.get("to_columns") or [])))
            constraints.append(
                Constraint(
                    constraint_name=name,
                    constraint_type=ctype,
                    owning_asset=asset_ids[unique_id],
                    constrained_fields=fields_list,
                    enforced=True,
                )
            )

    return assets, fields, constraints, lineage_edges, catalog, warnings, errors


def build_metadata_snapshot(
    *,
    database_url: Optional[str] = None,
    manifest_path: Optional[Path] = None,
    catalog_path: Optional[Path] = None,
    repo_root: Optional[Path] = None,
    conn: Optional[psycopg.Connection] = None,
) -> MetadataSnapshot:
    """Construct a deterministic metadata snapshot for PostgreSQL plus dbt artifacts."""
    started_at = datetime.now(timezone.utc)
    warnings: List[str] = []
    errors: List[str] = []
    extraction_sources: List[str] = []
    assets: List[Asset] = []
    fields: List[Field] = []
    constraints: List[Constraint] = []
    lineage_edges: List[LineageEdge] = []
    postgres_server_version: Optional[str] = None

    sanitized_url = _sanitize_database_url(database_url)
    if conn is None and sanitized_url:
        conn = psycopg.connect(database_url, row_factory=dict_row)
        extraction_sources.append(f"postgres:{sanitized_url}")
    elif conn is not None:
        extraction_sources.append("postgres:connection")

    if conn is not None:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                version_row = cur.fetchone()
                if version_row:
                    version_value = (
                        version_row.get("version")
                        if isinstance(version_row, dict)
                        else version_row[0]
                    )
                    postgres_server_version = (
                        str(version_value).split("on ")[-1].split(",")[0] if version_value else None
                    )
            pg_assets, pg_fields, pg_constraints, pg_warnings, pg_errors = (
                extract_postgres_metadata(conn)
            )
            assets.extend(pg_assets)
            fields.extend(pg_fields)
            constraints.extend(pg_constraints)
            warnings.extend(pg_warnings)
            errors.extend(pg_errors)
            extraction_sources.append("postgres:information_schema")
        finally:
            if conn is not None and database_url is not None:
                conn.close()

    if manifest_path is not None:
        manifest_file = Path(manifest_path)
        if manifest_file.exists():
            catalog_file = (
                catalog_path if catalog_path is not None else manifest_file.parent / "catalog.json"
            )
            dbt_assets, dbt_fields, dbt_constraints, dbt_edges, _, dbt_warnings, dbt_errors = (
                extract_dbt_metadata(
                    manifest_file,
                    catalog_file,
                )
            )
            assets.extend(dbt_assets)
            fields.extend(dbt_fields)
            constraints.extend(dbt_constraints)
            lineage_edges.extend(dbt_edges)
            warnings.extend(dbt_warnings)
            errors.extend(dbt_errors)
            extraction_sources.append(str(manifest_file))

    if not assets and manifest_path is None and conn is None:
        warnings.append(
            "No PostgreSQL or dbt source was supplied; snapshot is intentionally empty."
        )

    deduped_assets: List[Asset] = []
    seen_assets: set[str] = set()
    for asset in sorted(
        assets, key=lambda a: (a.platform, a.database or "", a.schema or "", a.name)
    ):
        if asset.asset_id in seen_assets:
            continue
        seen_assets.add(asset.asset_id)
        deduped_assets.append(asset)

    deduped_fields: List[Field] = []
    seen_fields: set[Tuple[str, str]] = set()
    for field in sorted(fields, key=lambda f: (f.asset_id, f.field_name)):
        key = (field.asset_id, field.field_name)
        if key in seen_fields:
            continue
        seen_fields.add(key)
        deduped_fields.append(field)

    deduped_constraints: List[Constraint] = []
    seen_constraints: set[Tuple[str, str, str]] = set()
    for constraint in sorted(
        constraints, key=lambda c: (c.owning_asset, c.constraint_name, c.constraint_type)
    ):
        key = (constraint.constraint_name, constraint.constraint_type, constraint.owning_asset)
        if key in seen_constraints:
            continue
        seen_constraints.add(key)
        deduped_constraints.append(constraint)

    deduped_edges: List[LineageEdge] = []
    seen_edges: set[Tuple[str, str, str]] = set()
    for edge in sorted(lineage_edges, key=lambda e: (e.source_asset, e.target_asset, e.edge_type)):
        key = (edge.source_asset, edge.target_asset, edge.edge_type)
        if key in seen_edges:
            continue
        seen_edges.add(key)
        deduped_edges.append(edge)

    snapshot = MetadataSnapshot(
        schema_version="1.0.0",
        snapshot_id=f"snapshot-{uuid.uuid4().hex}",
        generated_at=datetime.now(timezone.utc),
        extractor_version="lotuslearn-pipeline/0.1.0",
        repository_commit=_detect_repository_commit(repo_root),
        postgres_server_version=postgres_server_version,
        dbt_version=_detect_dbt_version(),
        dbt_artifact_schema_version=None,
        extraction_sources=sorted(set(extraction_sources)),
        assets=deduped_assets,
        fields=deduped_fields,
        constraints=deduped_constraints,
        lineage_edges=deduped_edges,
        warnings=sorted(set(warnings)),
        errors=sorted(set(errors)),
        run=ExtractionRun(
            run_id=f"metadata-{uuid.uuid4().hex}",
            start_time=started_at,
            completion_time=datetime.now(timezone.utc),
            status="success" if not errors else "failed",
            extraction_counts={
                "assets": len(deduped_assets),
                "fields": len(deduped_fields),
                "constraints": len(deduped_constraints),
                "lineage_edges": len(deduped_edges),
            },
            warnings=sorted(set(warnings)),
            errors=sorted(set(errors)),
            source_versions={
                "python": os.environ.get("PYTHON_VERSION", "unknown"),
                "dbt": _detect_dbt_version() or "unknown",
                "postgres": postgres_server_version or "unknown",
            },
        ),
    )
    snapshot.content_checksum = snapshot.compute_checksum()
    return snapshot


def validate_metadata_snapshot(snapshot: MetadataSnapshot) -> MetadataValidationResult:
    """Validate canonical metadata integrity and fail closed on structural defects."""
    warnings: List[str] = [_sanitize_for_validation(value) for value in snapshot.warnings]
    errors: List[str] = [_sanitize_for_validation(value) for value in snapshot.errors]

    if snapshot.schema_version not in SUPPORTED_SCHEMA_VERSIONS:
        errors.append(f"Unsupported metadata schema version: {snapshot.schema_version}")

    if (
        snapshot.dbt_artifact_schema_version
        and snapshot.dbt_artifact_schema_version not in SUPPORTED_DBT_ARTIFACT_SCHEMAS
    ):
        warnings.append(
            f"Unknown dbt artifact schema version: {snapshot.dbt_artifact_schema_version}"
        )

    asset_ids = {asset.asset_id for asset in snapshot.assets}
    if len(asset_ids) != len(snapshot.assets):
        errors.append("Duplicate asset IDs detected in metadata snapshot.")

    field_identities: set[Tuple[str, str]] = set()
    for field in snapshot.fields:
        if field.asset_id not in asset_ids:
            errors.append(f"Field refers to missing asset: {field.asset_id}")
        field_key = (field.asset_id, field.field_name)
        if field_key in field_identities:
            errors.append(f"Duplicate field identity within an asset: {field_key}")
        field_identities.add(field_key)

    for field in snapshot.fields:
        if field.ordinal_position is not None and field.ordinal_position <= 0:
            errors.append(
                f"Invalid ordinal position for field {field.field_name}: {field.ordinal_position}"
            )

    for constraint in snapshot.constraints:
        if constraint.owning_asset not in asset_ids:
            errors.append(f"Constraint references missing owning asset: {constraint.owning_asset}")
        if constraint.referenced_asset is not None and constraint.referenced_asset not in asset_ids:
            errors.append(
                f"Constraint references missing foreign asset: {constraint.referenced_asset}"
            )
        if len(constraint.constrained_fields) == 0:
            errors.append(f"Constraint has no constrained fields: {constraint.constraint_name}")

    seen_edges: set[Tuple[str, str, str]] = set()
    for edge in snapshot.lineage_edges:
        if edge.source_asset not in asset_ids or edge.target_asset not in asset_ids:
            errors.append(
                f"Lineage edge references missing asset: {edge.source_asset} -> {edge.target_asset}"
            )
        edge_key = (edge.source_asset, edge.target_asset, edge.edge_type)
        if edge_key in seen_edges:
            errors.append(f"Duplicate lineage edge: {edge_key}")
        seen_edges.add(edge_key)

    for value in [
        *snapshot.extraction_sources,
        *[a.name for a in snapshot.assets],
        *[f.field_name for f in snapshot.fields],
        *snapshot.warnings,
        *snapshot.errors,
    ]:
        sanitized_value = _sanitize_for_validation(value)
        lowered = str(sanitized_value).lower()
        if any(token in lowered for token in PROHIBITED_METADATA_TOKENS):
            errors.append(
                "Potentially sensitive metadata token detected in extracted metadata value."
            )
        if any(token in lowered for token in PROHIBITED_PII_TOKENS):
            errors.append("Potential row-level PII token detected in extracted metadata value.")

    checksum = snapshot.compute_checksum()
    if checksum != snapshot.content_checksum:
        errors.append("Content checksum drift detected; snapshot is not deterministic.")

    return MetadataValidationResult(
        is_valid=not errors,
        warnings=sorted(set(warnings)),
        errors=sorted(set(errors)),
    )


def extract_metadata_snapshot(
    *,
    database_url: Optional[str] = None,
    manifest_path: Optional[Path | str] = None,
    catalog_path: Optional[Path | str] = None,
    repo_root: Optional[Path | str] = None,
    conn: Optional[psycopg.Connection] = None,
) -> MetadataSnapshot:
    """Create a canonical metadata snapshot for the current PostgreSQL + dbt estate."""
    manifest_file = Path(manifest_path) if manifest_path else None
    catalog_file = Path(catalog_path) if catalog_path else None
    repo_root_path = Path(repo_root) if repo_root else None
    snapshot = build_metadata_snapshot(
        database_url=database_url,
        manifest_path=manifest_file,
        catalog_path=catalog_file,
        repo_root=repo_root_path,
        conn=conn,
    )
    if manifest_file is not None and manifest_file.exists():
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        metadata = manifest.get("metadata") or {}
        snapshot.dbt_artifact_schema_version = str(metadata.get("dbt_schema_version") or "unknown")
    return snapshot


__all__ = [
    "Asset",
    "Constraint",
    "Field",
    "ExtractionRun",
    "LineageEdge",
    "MetadataSnapshot",
    "MetadataValidationResult",
    "build_metadata_snapshot",
    "derive_asset_id",
    "extract_dbt_metadata",
    "extract_metadata_snapshot",
    "extract_postgres_metadata",
    "validate_metadata_snapshot",
]
