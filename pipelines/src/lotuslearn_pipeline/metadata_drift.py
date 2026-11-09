"""Deterministic, privacy-conscious comparison of metadata snapshots.

Asset renames are represented as removal plus addition because asset identity is
the stable logical-relation ID. This module does not infer rename intent or
claim universal producer/consumer compatibility; its severity policy is a
conservative LotusLearn governance policy.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict, deque
from dataclasses import dataclass
from enum import Enum
from typing import Any, Mapping, Optional, Sequence

from lotuslearn_pipeline.metadata import (
    Field,
    MetadataIntegrityError,
    MetadataSnapshot,
    validate_metadata_snapshot,
)


class MetadataChangeSeverity(str, Enum):
    BREAKING = "BREAKING"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    NON_BREAKING = "NON_BREAKING"
    METADATA_ONLY = "METADATA_ONLY"


class MetadataEntityType(str, Enum):
    ASSET = "ASSET"
    FIELD = "FIELD"
    CONSTRAINT = "CONSTRAINT"
    LINEAGE_EDGE = "LINEAGE_EDGE"


class MetadataChangeKind(str, Enum):
    ASSET_ADDED = "ASSET_ADDED"
    ASSET_REMOVED = "ASSET_REMOVED"
    ASSET_TYPE_CHANGED = "ASSET_TYPE_CHANGED"
    MATERIALIZATION_CHANGED = "MATERIALIZATION_CHANGED"
    OWNER_CHANGED = "OWNER_CHANGED"
    ASSET_DESCRIPTION_CHANGED = "ASSET_DESCRIPTION_CHANGED"
    ASSET_SOURCE_METADATA_CHANGED = "ASSET_SOURCE_METADATA_CHANGED"
    FIELD_ADDED = "FIELD_ADDED"
    FIELD_REMOVED = "FIELD_REMOVED"
    FIELD_TYPE_CHANGED = "FIELD_TYPE_CHANGED"
    FIELD_NULLABILITY_CHANGED = "FIELD_NULLABILITY_CHANGED"
    FIELD_DEFAULT_CHANGED = "FIELD_DEFAULT_CHANGED"
    FIELD_ORDINAL_POSITION_CHANGED = "FIELD_ORDINAL_POSITION_CHANGED"
    FIELD_DESCRIPTION_CHANGED = "FIELD_DESCRIPTION_CHANGED"
    CONSTRAINT_ADDED = "CONSTRAINT_ADDED"
    CONSTRAINT_REMOVED = "CONSTRAINT_REMOVED"
    CONSTRAINT_MODIFIED = "CONSTRAINT_MODIFIED"
    LINEAGE_EDGE_ADDED = "LINEAGE_EDGE_ADDED"
    LINEAGE_EDGE_REMOVED = "LINEAGE_EDGE_REMOVED"
    LINEAGE_EDGE_MODIFIED = "LINEAGE_EDGE_MODIFIED"


SafeValue = Optional[str | int | bool]
SafePairs = tuple[tuple[str, SafeValue], ...]


@dataclass(frozen=True)
class MetadataChange:
    change_id: str
    entity_id: str
    entity_type: MetadataEntityType
    kind: MetadataChangeKind
    severity: MetadataChangeSeverity
    asset_id: Optional[str] = None
    field_name: Optional[str] = None
    related_asset_ids: tuple[str, ...] = ()
    changed_properties: tuple[str, ...] = ()
    before: SafePairs = ()
    after: SafePairs = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "change_id": self.change_id,
            "entity_id": self.entity_id,
            "entity_type": self.entity_type.value,
            "kind": self.kind.value,
            "severity": self.severity.value,
            "asset_id": self.asset_id,
            "field_name": self.field_name,
            "related_asset_ids": list(self.related_asset_ids),
            "changed_properties": list(self.changed_properties),
            "before": dict(self.before),
            "after": dict(self.after),
        }


@dataclass(frozen=True)
class MetadataDiff:
    comparison_id: str
    baseline_checksum: str
    current_checksum: str
    changes: tuple[MetadataChange, ...]
    directly_changed_assets: tuple[str, ...]
    downstream_impacted_assets: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "comparison_id": self.comparison_id,
            "baseline_checksum": self.baseline_checksum,
            "current_checksum": self.current_checksum,
            "changes": [change.to_dict() for change in self.changes],
            "directly_changed_assets": list(self.directly_changed_assets),
            "downstream_impacted_assets": list(self.downstream_impacted_assets),
        }


_SEVERITY_RANK = {
    MetadataChangeSeverity.BREAKING: 0,
    MetadataChangeSeverity.REVIEW_REQUIRED: 1,
    MetadataChangeSeverity.NON_BREAKING: 2,
    MetadataChangeSeverity.METADATA_ONLY: 3,
}
_ENTITY_RANK = {
    MetadataEntityType.ASSET: 0,
    MetadataEntityType.FIELD: 1,
    MetadataEntityType.CONSTRAINT: 2,
    MetadataEntityType.LINEAGE_EDGE: 3,
}
_SENSITIVE_VALUE = re.compile(
    r"(?i)(password|passwd|secret|token|credential|api[_-]?key|bearer|://|@)"
)
_SAFE_FIELD_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]{0,127}$")
_HEX_SHA256 = re.compile(r"^[0-9a-fA-F]{64}$")
_SAFE_NORMALIZED_TYPES = frozenset(
    {
        "array",
        "bigint",
        "bigserial",
        "bit",
        "bit varying",
        "boolean",
        "bool",
        "bytea",
        "char",
        "character",
        "character varying",
        "date",
        "decimal",
        "double precision",
        "integer",
        "int",
        "interval",
        "json",
        "jsonb",
        "money",
        "numeric",
        "oid",
        "real",
        "record",
        "serial",
        "smallint",
        "smallserial",
        "text",
        "time",
        "time with time zone",
        "time without time zone",
        "timestamp",
        "timestamp with time zone",
        "timestamp without time zone",
        "unknown",
        "user-defined",
        "uuid",
        "varchar",
        "xml",
    }
)
_SAFE_ASSET_TYPES = frozenset(
    {
        "base_table",
        "exposure",
        "materialized_view",
        "metric",
        "model",
        "semantic_model",
        "seed",
        "snapshot",
        "source",
        "table",
        "test",
        "unknown",
        "view",
    }
)
_SAFE_MATERIALIZATIONS = frozenset(
    {"ephemeral", "incremental", "materialized_view", "snapshot", "table", "unknown", "view"}
)
_SAFE_CONSTRAINT_TYPES = frozenset(
    {
        "check",
        "check constraint",
        "foreign key",
        "foreign_key",
        "not null",
        "not_null",
        "primary key",
        "primary_key",
        "unique",
        "unique constraint",
        "unknown",
    }
)
_SAFE_EDGE_TYPES = frozenset({"dbt_parent"})


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _digest(value: Any) -> str:
    return hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()


def _safe_asset_id(asset_id: str) -> str:
    if _HEX_SHA256.fullmatch(asset_id):
        return asset_id.lower()
    return hashlib.sha256(asset_id.encode("utf-8")).hexdigest()


def _safe_field_name(field_name: str) -> str:
    if _SAFE_FIELD_NAME.fullmatch(field_name) and not _SENSITIVE_VALUE.search(field_name):
        return field_name
    return "<redacted>"


def _safe_label(value: Optional[str], allowed_values: frozenset[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = " ".join(str(value).strip().lower().split())
    return normalized if normalized in allowed_values else "<redacted>"


def _safe_normalized_type(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = " ".join(str(value).strip().lower().split())
    match = re.fullmatch(
        r"([a-z][a-z0-9_]*(?: [a-z][a-z0-9_]*)*)(?:\(\d+(?:\s*,\s*\d+)?\))?",
        normalized,
    )
    if match is None or match.group(1) not in _SAFE_NORMALIZED_TYPES:
        return "<redacted>"
    return normalized


def _safe_pairs(values: Optional[Mapping[str, SafeValue]] = None) -> SafePairs:
    if not values:
        return ()
    return tuple(sorted(values.items()))


def classify_metadata_change_severity(
    kind: MetadataChangeKind,
    *,
    before: Optional[Mapping[str, Any]] = None,
    after: Optional[Mapping[str, Any]] = None,
) -> MetadataChangeSeverity:
    """Apply LotusLearn's conservative policy to one semantic change."""
    before_values = before or {}
    after_values = after or {}

    if kind in {
        MetadataChangeKind.ASSET_REMOVED,
        MetadataChangeKind.FIELD_REMOVED,
        MetadataChangeKind.FIELD_TYPE_CHANGED,
    }:
        return MetadataChangeSeverity.BREAKING
    if kind == MetadataChangeKind.FIELD_ADDED:
        if after_values.get("nullable") is False and not after_values.get("default_present"):
            return MetadataChangeSeverity.BREAKING
        return MetadataChangeSeverity.NON_BREAKING
    if kind == MetadataChangeKind.FIELD_NULLABILITY_CHANGED:
        if (
            after_values.get("nullable") is False
            and before_values.get("nullable") is not False
        ):
            return MetadataChangeSeverity.BREAKING
        return MetadataChangeSeverity.REVIEW_REQUIRED
    if kind in {
        MetadataChangeKind.ASSET_DESCRIPTION_CHANGED,
        MetadataChangeKind.FIELD_DESCRIPTION_CHANGED,
    }:
        return MetadataChangeSeverity.METADATA_ONLY
    if kind in {
        MetadataChangeKind.ASSET_ADDED,
        MetadataChangeKind.LINEAGE_EDGE_ADDED,
    }:
        return MetadataChangeSeverity.NON_BREAKING
    if kind in {
        MetadataChangeKind.ASSET_TYPE_CHANGED,
        MetadataChangeKind.MATERIALIZATION_CHANGED,
        MetadataChangeKind.OWNER_CHANGED,
        MetadataChangeKind.ASSET_SOURCE_METADATA_CHANGED,
        MetadataChangeKind.FIELD_DEFAULT_CHANGED,
        MetadataChangeKind.FIELD_ORDINAL_POSITION_CHANGED,
        MetadataChangeKind.CONSTRAINT_ADDED,
        MetadataChangeKind.CONSTRAINT_REMOVED,
        MetadataChangeKind.CONSTRAINT_MODIFIED,
        MetadataChangeKind.LINEAGE_EDGE_REMOVED,
        MetadataChangeKind.LINEAGE_EDGE_MODIFIED,
    }:
        return MetadataChangeSeverity.REVIEW_REQUIRED
    raise ValueError("Unsupported metadata change kind")


def _validate_snapshot(snapshot: MetadataSnapshot, label: str) -> None:
    if not isinstance(snapshot, MetadataSnapshot):
        raise MetadataIntegrityError(f"{label} metadata snapshot failed integrity validation")
    result = validate_metadata_snapshot(snapshot)
    if not result.is_valid:
        raise MetadataIntegrityError(f"{label} metadata snapshot failed integrity validation")


def _unique_index(items: Sequence[Any], key: Any, label: str) -> dict[Any, Any]:
    indexed: dict[Any, Any] = {}
    for item in items:
        identity = key(item)
        if identity in indexed:
            raise MetadataIntegrityError(f"Metadata snapshot contains duplicate {label} identities")
        indexed[identity] = item
    return indexed


def _make_change(
    *,
    baseline_checksum: str,
    current_checksum: str,
    entity_type: MetadataEntityType,
    kind: MetadataChangeKind,
    identity: Sequence[Any],
    asset_id: Optional[str] = None,
    field_name: Optional[str] = None,
    related_asset_ids: Sequence[str] = (),
    changed_properties: Sequence[str] = (),
    before: Optional[Mapping[str, SafeValue]] = None,
    after: Optional[Mapping[str, SafeValue]] = None,
    policy_before: Optional[Mapping[str, Any]] = None,
    policy_after: Optional[Mapping[str, Any]] = None,
) -> MetadataChange:
    safe_before = _safe_pairs(before)
    safe_after = _safe_pairs(after)
    properties = tuple(sorted(set(changed_properties)))
    identity_value = list(identity)
    entity_id = _digest({"entity_type": entity_type.value, "identity": identity_value})
    change_id = _digest(
        {
            "baseline_checksum": baseline_checksum,
            "current_checksum": current_checksum,
            "entity_type": entity_type.value,
            "identity": identity_value,
            "kind": kind.value,
            "changed_properties": list(properties),
            "before": dict(safe_before),
            "after": dict(safe_after),
        }
    )
    return MetadataChange(
        change_id=change_id,
        entity_id=entity_id,
        entity_type=entity_type,
        kind=kind,
        severity=classify_metadata_change_severity(
            kind, before=policy_before, after=policy_after
        ),
        asset_id=_safe_asset_id(asset_id) if asset_id is not None else None,
        field_name=_safe_field_name(field_name) if field_name is not None else None,
        related_asset_ids=tuple(sorted({_safe_asset_id(value) for value in related_asset_ids})),
        changed_properties=properties,
        before=safe_before,
        after=safe_after,
    )


def _has_default(field: Field) -> bool:
    return field.default_expression is not None and bool(field.default_expression.strip())


def _graph_union(*snapshots: MetadataSnapshot) -> dict[str, set[str]]:
    graph: dict[str, set[str]] = defaultdict(set)
    for snapshot in snapshots:
        for edge in snapshot.lineage_edges:
            graph[edge.source_asset].add(edge.target_asset)
    return graph


def _downstream_assets(graph: Mapping[str, set[str]], seeds: set[str]) -> set[str]:
    visited = set(seeds)
    pending = deque(sorted(seeds))
    while pending:
        source = pending.popleft()
        for target in sorted(graph.get(source, set())):
            if target not in visited:
                visited.add(target)
                pending.append(target)
    return visited


def compare_metadata_snapshots(
    baseline: MetadataSnapshot,
    current: MetadataSnapshot,
) -> MetadataDiff:
    """Compare semantic entities; changed edge targets seed lineage impact traversal."""
    _validate_snapshot(baseline, "Baseline")
    _validate_snapshot(current, "Current")

    baseline_checksum = baseline.content_checksum
    current_checksum = current.content_checksum
    comparison_id = _digest(
        {"baseline_checksum": baseline_checksum, "current_checksum": current_checksum}
    )
    changes: list[MetadataChange] = []
    direct_assets: set[str] = set()

    baseline_assets = _unique_index(baseline.assets, lambda item: item.asset_id, "asset")
    current_assets = _unique_index(current.assets, lambda item: item.asset_id, "asset")
    for asset_id in sorted(baseline_assets.keys() | current_assets.keys()):
        old = baseline_assets.get(asset_id)
        new = current_assets.get(asset_id)
        if old is None or new is None:
            kind = (
                MetadataChangeKind.ASSET_ADDED
                if old is None
                else MetadataChangeKind.ASSET_REMOVED
            )
            changes.append(
                _make_change(
                    baseline_checksum=baseline_checksum,
                    current_checksum=current_checksum,
                    entity_type=MetadataEntityType.ASSET,
                    kind=kind,
                    identity=(asset_id,),
                    asset_id=asset_id,
                    changed_properties=("asset",),
                    after=(
                        {
                            "asset_type": _safe_label(new.asset_type, _SAFE_ASSET_TYPES),
                            "materialization": _safe_label(
                                new.materialization, _SAFE_MATERIALIZATIONS
                            ),
                        }
                        if new
                        else None
                    ),
                    before=(
                        {
                            "asset_type": _safe_label(old.asset_type, _SAFE_ASSET_TYPES),
                            "materialization": _safe_label(
                                old.materialization, _SAFE_MATERIALIZATIONS
                            ),
                        }
                        if old
                        else None
                    ),
                )
            )
            direct_assets.add(asset_id)
            continue

        for property_name, changed, kind in (
            ("asset_type", old.asset_type != new.asset_type, MetadataChangeKind.ASSET_TYPE_CHANGED),
            (
                "materialization",
                old.materialization != new.materialization,
                MetadataChangeKind.MATERIALIZATION_CHANGED,
            ),
            ("owner", old.owner != new.owner, MetadataChangeKind.OWNER_CHANGED),
            (
                "description",
                old.description != new.description,
                MetadataChangeKind.ASSET_DESCRIPTION_CHANGED,
            ),
        ):
            if changed:
                changes.append(
                    _make_change(
                        baseline_checksum=baseline_checksum,
                        current_checksum=current_checksum,
                        entity_type=MetadataEntityType.ASSET,
                        kind=kind,
                        identity=(asset_id,),
                        asset_id=asset_id,
                        changed_properties=(property_name,),
                        before=(
                            {
                                property_name: _safe_label(old.asset_type, _SAFE_ASSET_TYPES)
                                if property_name == "asset_type"
                                else _safe_label(old.materialization, _SAFE_MATERIALIZATIONS)
                            }
                            if property_name in {"asset_type", "materialization"}
                            else None
                        ),
                        after=(
                            {
                                property_name: _safe_label(new.asset_type, _SAFE_ASSET_TYPES)
                                if property_name == "asset_type"
                                else _safe_label(new.materialization, _SAFE_MATERIALIZATIONS)
                            }
                            if property_name in {"asset_type", "materialization"}
                            else None
                        ),
                    )
                )
                direct_assets.add(asset_id)

        source_properties = ("dbt_unique_id", "dbt_resource_type", "source_file")
        changed_source_properties = tuple(
            name for name in source_properties if getattr(old, name) != getattr(new, name)
        )
        if changed_source_properties:
            changes.append(
                _make_change(
                    baseline_checksum=baseline_checksum,
                    current_checksum=current_checksum,
                    entity_type=MetadataEntityType.ASSET,
                    kind=MetadataChangeKind.ASSET_SOURCE_METADATA_CHANGED,
                    identity=(asset_id,),
                    asset_id=asset_id,
                    changed_properties=changed_source_properties,
                )
            )
            direct_assets.add(asset_id)

    baseline_fields = _unique_index(
        baseline.fields, lambda item: (item.asset_id, item.field_name), "field"
    )
    current_fields = _unique_index(
        current.fields, lambda item: (item.asset_id, item.field_name), "field"
    )
    for identity in sorted(baseline_fields.keys() | current_fields.keys()):
        old = baseline_fields.get(identity)
        new = current_fields.get(identity)
        asset_id, field_name = identity
        if old is None or new is None:
            added = old is None
            field = new if added else old
            kind = MetadataChangeKind.FIELD_ADDED if added else MetadataChangeKind.FIELD_REMOVED
            details = {
                "nullable": field.nullable,
                "default_present": _has_default(field),
                "normalized_type": _safe_normalized_type(field.normalized_type),
            }
            changes.append(
                _make_change(
                    baseline_checksum=baseline_checksum,
                    current_checksum=current_checksum,
                    entity_type=MetadataEntityType.FIELD,
                    kind=kind,
                    identity=identity,
                    asset_id=asset_id,
                    field_name=field_name,
                    changed_properties=("field",),
                    after=details if added else None,
                    before=details if not added else None,
                    policy_after=(
                        {"nullable": field.nullable, "default_present": _has_default(field)}
                        if added
                        else None
                    ),
                )
            )
            direct_assets.add(asset_id)
            continue

        if (
            old.physical_data_type != new.physical_data_type
            or old.normalized_type != new.normalized_type
        ):
            changed = tuple(
                name
                for name in ("physical_data_type", "normalized_type")
                if getattr(old, name) != getattr(new, name)
            )
            changes.append(
                _make_change(
                    baseline_checksum=baseline_checksum,
                    current_checksum=current_checksum,
                    entity_type=MetadataEntityType.FIELD,
                    kind=MetadataChangeKind.FIELD_TYPE_CHANGED,
                    identity=identity,
                    asset_id=asset_id,
                    field_name=field_name,
                    changed_properties=changed,
                    before={"normalized_type": _safe_normalized_type(old.normalized_type)},
                    after={"normalized_type": _safe_normalized_type(new.normalized_type)},
                )
            )
            direct_assets.add(asset_id)

        if old.nullable != new.nullable:
            changes.append(
                _make_change(
                    baseline_checksum=baseline_checksum,
                    current_checksum=current_checksum,
                    entity_type=MetadataEntityType.FIELD,
                    kind=MetadataChangeKind.FIELD_NULLABILITY_CHANGED,
                    identity=identity,
                    asset_id=asset_id,
                    field_name=field_name,
                    changed_properties=("nullable",),
                    before={"nullable": old.nullable},
                    after={"nullable": new.nullable},
                    policy_before={"nullable": old.nullable},
                    policy_after={"nullable": new.nullable},
                )
            )
            direct_assets.add(asset_id)

        if old.default_expression != new.default_expression:
            changes.append(
                _make_change(
                    baseline_checksum=baseline_checksum,
                    current_checksum=current_checksum,
                    entity_type=MetadataEntityType.FIELD,
                    kind=MetadataChangeKind.FIELD_DEFAULT_CHANGED,
                    identity=identity,
                    asset_id=asset_id,
                    field_name=field_name,
                    changed_properties=("default_expression",),
                    before={"default_present": _has_default(old)},
                    after={"default_present": _has_default(new)},
                )
            )
            direct_assets.add(asset_id)

        if old.ordinal_position != new.ordinal_position:
            changes.append(
                _make_change(
                    baseline_checksum=baseline_checksum,
                    current_checksum=current_checksum,
                    entity_type=MetadataEntityType.FIELD,
                    kind=MetadataChangeKind.FIELD_ORDINAL_POSITION_CHANGED,
                    identity=identity,
                    asset_id=asset_id,
                    field_name=field_name,
                    changed_properties=("ordinal_position",),
                    before={"ordinal_position": old.ordinal_position},
                    after={"ordinal_position": new.ordinal_position},
                )
            )
            direct_assets.add(asset_id)

        changed_descriptions = tuple(
            name
            for name in ("description", "dbt_description")
            if getattr(old, name) != getattr(new, name)
        )
        if changed_descriptions:
            changes.append(
                _make_change(
                    baseline_checksum=baseline_checksum,
                    current_checksum=current_checksum,
                    entity_type=MetadataEntityType.FIELD,
                    kind=MetadataChangeKind.FIELD_DESCRIPTION_CHANGED,
                    identity=identity,
                    asset_id=asset_id,
                    field_name=field_name,
                    changed_properties=changed_descriptions,
                )
            )
            direct_assets.add(asset_id)

    def constraint_key(item: Any) -> tuple[str, str, str]:
        return (item.owning_asset, item.constraint_name, item.constraint_type)

    baseline_constraints = _unique_index(baseline.constraints, constraint_key, "constraint")
    current_constraints = _unique_index(current.constraints, constraint_key, "constraint")
    constraint_properties = (
        "constrained_fields",
        "referenced_asset",
        "referenced_fields",
        "update_rule",
        "delete_rule",
        "deferrable",
        "initially_deferred",
        "enforced",
    )
    for identity in sorted(baseline_constraints.keys() | current_constraints.keys()):
        old = baseline_constraints.get(identity)
        new = current_constraints.get(identity)
        owning_asset, _constraint_name, _constraint_type = identity
        if old is None or new is None:
            added = old is None
            kind = (
                MetadataChangeKind.CONSTRAINT_ADDED
                if added
                else MetadataChangeKind.CONSTRAINT_REMOVED
            )
            changes.append(
                _make_change(
                    baseline_checksum=baseline_checksum,
                    current_checksum=current_checksum,
                    entity_type=MetadataEntityType.CONSTRAINT,
                    kind=kind,
                    identity=identity,
                    asset_id=owning_asset,
                    changed_properties=("constraint",),
                    after=(
                        {"constraint_type": _safe_label(identity[2], _SAFE_CONSTRAINT_TYPES)}
                        if added
                        else None
                    ),
                    before=(
                        {"constraint_type": _safe_label(identity[2], _SAFE_CONSTRAINT_TYPES)}
                        if not added
                        else None
                    ),
                )
            )
            direct_assets.add(owning_asset)
            continue

        changed_properties = tuple(
            name for name in constraint_properties if getattr(old, name) != getattr(new, name)
        )
        if changed_properties:
            changes.append(
                _make_change(
                    baseline_checksum=baseline_checksum,
                    current_checksum=current_checksum,
                    entity_type=MetadataEntityType.CONSTRAINT,
                    kind=MetadataChangeKind.CONSTRAINT_MODIFIED,
                    identity=identity,
                    asset_id=owning_asset,
                    changed_properties=changed_properties,
                    before={
                        "constraint_type": _safe_label(identity[2], _SAFE_CONSTRAINT_TYPES)
                    },
                    after={
                        "constraint_type": _safe_label(identity[2], _SAFE_CONSTRAINT_TYPES)
                    },
                )
            )
            direct_assets.add(owning_asset)

    def edge_key(item: Any) -> tuple[str, str, str]:
        return (item.source_asset, item.target_asset, item.edge_type)

    baseline_edges = _unique_index(baseline.lineage_edges, edge_key, "lineage edge")
    current_edges = _unique_index(current.lineage_edges, edge_key, "lineage edge")
    edge_properties = ("transformation_owner", "evidence_source", "source_fields", "target_fields")
    for identity in sorted(baseline_edges.keys() | current_edges.keys()):
        old = baseline_edges.get(identity)
        new = current_edges.get(identity)
        source_asset, target_asset, _edge_type = identity
        if old is None or new is None:
            added = old is None
            kind = (
                MetadataChangeKind.LINEAGE_EDGE_ADDED
                if added
                else MetadataChangeKind.LINEAGE_EDGE_REMOVED
            )
            changes.append(
                _make_change(
                    baseline_checksum=baseline_checksum,
                    current_checksum=current_checksum,
                    entity_type=MetadataEntityType.LINEAGE_EDGE,
                    kind=kind,
                    identity=identity,
                    asset_id=target_asset,
                    related_asset_ids=(source_asset, target_asset),
                    changed_properties=("relationship",),
                    after=(
                        {"edge_type": _safe_label(identity[2], _SAFE_EDGE_TYPES)}
                        if added
                        else None
                    ),
                    before=(
                        {"edge_type": _safe_label(identity[2], _SAFE_EDGE_TYPES)}
                        if not added
                        else None
                    ),
                )
            )
            direct_assets.add(target_asset)
            continue

        changed_properties = tuple(
            name for name in edge_properties if getattr(old, name) != getattr(new, name)
        )
        if changed_properties:
            changes.append(
                _make_change(
                    baseline_checksum=baseline_checksum,
                    current_checksum=current_checksum,
                    entity_type=MetadataEntityType.LINEAGE_EDGE,
                    kind=MetadataChangeKind.LINEAGE_EDGE_MODIFIED,
                    identity=identity,
                    asset_id=target_asset,
                    related_asset_ids=(source_asset, target_asset),
                    changed_properties=changed_properties,
                    before={"edge_type": _safe_label(identity[2], _SAFE_EDGE_TYPES)},
                    after={"edge_type": _safe_label(identity[2], _SAFE_EDGE_TYPES)},
                )
            )
            direct_assets.add(target_asset)

    changes.sort(
        key=lambda change: (
            _SEVERITY_RANK[change.severity],
            _ENTITY_RANK[change.entity_type],
            change.asset_id or "",
            change.field_name or "",
            change.kind.value,
            change.change_id,
        )
    )

    graph = _graph_union(baseline, current)
    reached = _downstream_assets(graph, direct_assets)
    downstream_assets = reached - direct_assets
    return MetadataDiff(
        comparison_id=comparison_id,
        baseline_checksum=baseline_checksum,
        current_checksum=current_checksum,
        changes=tuple(changes),
        directly_changed_assets=tuple(sorted(_safe_asset_id(item) for item in direct_assets)),
        downstream_impacted_assets=tuple(
            sorted(_safe_asset_id(item) for item in downstream_assets)
        ),
    )


__all__ = [
    "MetadataChange",
    "MetadataChangeKind",
    "MetadataChangeSeverity",
    "MetadataDiff",
    "MetadataEntityType",
    "classify_metadata_change_severity",
    "compare_metadata_snapshots",
]
