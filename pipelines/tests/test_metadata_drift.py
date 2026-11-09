import json

import pytest

from lotuslearn_pipeline.metadata import (
    Asset,
    Constraint,
    Field,
    LineageEdge,
    MetadataIntegrityError,
    MetadataSnapshot,
    derive_asset_id,
)
from lotuslearn_pipeline.metadata_drift import (
    MetadataChangeKind,
    MetadataChangeSeverity,
    compare_metadata_snapshots,
)


def make_asset(name: str, **attributes) -> Asset:
    asset_id = derive_asset_id("postgres", "lotuslearn_test", "public", name)
    return Asset(
        asset_id=asset_id,
        platform="postgres",
        database="lotuslearn_test",
        schema="public",
        name=name,
        asset_type=attributes.pop("asset_type", "base_table"),
        **attributes,
    )


def make_field(asset_id: str, field_name: str = "value", **attributes) -> Field:
    return Field(
        asset_id=asset_id,
        field_name=field_name,
        ordinal_position=attributes.pop("ordinal_position", 1),
        physical_data_type=attributes.pop("physical_data_type", "integer"),
        normalized_type=attributes.pop("normalized_type", "integer"),
        nullable=attributes.pop("nullable", True),
        **attributes,
    )


def make_snapshot(
    *,
    assets=(),
    fields=(),
    constraints=(),
    lineage_edges=(),
    errors=(),
    repository_commit="commit-a",
) -> MetadataSnapshot:
    return MetadataSnapshot(
        repository_commit=repository_commit,
        assets=list(assets),
        fields=list(fields),
        constraints=list(constraints),
        lineage_edges=list(lineage_edges),
        errors=list(errors),
    )


def changes_of(diff, kind):
    return [change for change in diff.changes if change.kind == kind]


def test_identical_snapshots_produce_no_changes():
    asset = make_asset("orders")
    field = make_field(asset.asset_id)
    diff = compare_metadata_snapshots(
        make_snapshot(assets=[asset], fields=[field]),
        make_snapshot(assets=[asset], fields=[field]),
    )
    assert diff.changes == ()


def test_reordered_collections_produce_no_changes():
    first, second = make_asset("first"), make_asset("second")
    fields = [make_field(first.asset_id, "id"), make_field(second.asset_id, "id")]
    constraints = [
        Constraint("first_pk", "PRIMARY KEY", first.asset_id, ("id",)),
        Constraint("second_pk", "PRIMARY KEY", second.asset_id, ("id",)),
    ]
    edges = [
        LineageEdge(first.asset_id, second.asset_id, "dbt_parent"),
        LineageEdge(second.asset_id, first.asset_id, "dbt_parent"),
    ]
    baseline = make_snapshot(
        assets=[first, second], fields=fields, constraints=constraints, lineage_edges=edges
    )
    current = make_snapshot(
        assets=[second, first],
        fields=list(reversed(fields)),
        constraints=list(reversed(constraints)),
        lineage_edges=list(reversed(edges)),
    )
    assert compare_metadata_snapshots(baseline, current).changes == ()


def test_repository_commit_only_change_is_not_structural_drift():
    asset = make_asset("orders")
    baseline = make_snapshot(assets=[asset], repository_commit="abc123")
    current = make_snapshot(assets=[asset], repository_commit="def456")
    diff = compare_metadata_snapshots(baseline, current)
    assert baseline.content_checksum != current.content_checksum
    assert diff.changes == ()


def test_asset_addition_is_non_breaking():
    asset = make_asset("orders")
    diff = compare_metadata_snapshots(make_snapshot(), make_snapshot(assets=[asset]))
    change = changes_of(diff, MetadataChangeKind.ASSET_ADDED)[0]
    assert change.severity == MetadataChangeSeverity.NON_BREAKING


def test_asset_removal_is_breaking():
    asset = make_asset("orders")
    diff = compare_metadata_snapshots(make_snapshot(assets=[asset]), make_snapshot())
    change = changes_of(diff, MetadataChangeKind.ASSET_REMOVED)[0]
    assert change.severity == MetadataChangeSeverity.BREAKING


def test_asset_rename_is_remove_and_add_without_inference():
    old_asset, new_asset = make_asset("orders"), make_asset("sales_orders")
    diff = compare_metadata_snapshots(
        make_snapshot(assets=[old_asset]), make_snapshot(assets=[new_asset])
    )
    assert {change.kind for change in diff.changes} == {
        MetadataChangeKind.ASSET_REMOVED,
        MetadataChangeKind.ASSET_ADDED,
    }


@pytest.mark.parametrize(
    ("nullable", "default_expression", "expected"),
    [
        (True, None, MetadataChangeSeverity.NON_BREAKING),
        (False, None, MetadataChangeSeverity.BREAKING),
        (False, "0", MetadataChangeSeverity.NON_BREAKING),
    ],
)
def test_field_added_severity(nullable, default_expression, expected):
    asset = make_asset("orders")
    field = make_field(
        asset.asset_id, "required_value", nullable=nullable, default_expression=default_expression
    )
    diff = compare_metadata_snapshots(
        make_snapshot(assets=[asset]), make_snapshot(assets=[asset], fields=[field])
    )
    assert changes_of(diff, MetadataChangeKind.FIELD_ADDED)[0].severity == expected


def test_field_removal_is_breaking():
    asset = make_asset("orders")
    field = make_field(asset.asset_id)
    diff = compare_metadata_snapshots(
        make_snapshot(assets=[asset], fields=[field]), make_snapshot(assets=[asset])
    )
    change = changes_of(diff, MetadataChangeKind.FIELD_REMOVED)[0]
    assert change.severity == MetadataChangeSeverity.BREAKING


@pytest.mark.parametrize("property_name", ["physical_data_type", "normalized_type"])
def test_field_type_changes_are_breaking(property_name):
    asset = make_asset("orders")
    old_field = make_field(asset.asset_id)
    new_field = make_field(asset.asset_id, **{property_name: "decimal"})
    diff = compare_metadata_snapshots(
        make_snapshot(assets=[asset], fields=[old_field]),
        make_snapshot(assets=[asset], fields=[new_field]),
    )
    change = changes_of(diff, MetadataChangeKind.FIELD_TYPE_CHANGED)[0]
    assert change.severity == MetadataChangeSeverity.BREAKING
    assert property_name in change.changed_properties
    if property_name == "normalized_type":
        assert dict(change.before)["normalized_type"] == "integer"
        assert dict(change.after)["normalized_type"] == "decimal"


def test_unrecognized_type_and_materialization_labels_are_redacted():
    asset = make_asset("orders", materialization="password=hidden-value")
    current_asset = make_asset("orders", materialization="token=other-hidden-value")
    old_field = make_field(asset.asset_id, normalized_type="password=hidden-type")
    new_field = make_field(asset.asset_id, normalized_type="token=other-hidden-type")
    diff = compare_metadata_snapshots(
        make_snapshot(assets=[asset], fields=[old_field]),
        make_snapshot(assets=[current_asset], fields=[new_field]),
    )
    serialized = json.dumps(diff.to_dict())

    for private_value in (
        "hidden-value",
        "other-hidden-value",
        "hidden-type",
        "other-hidden-type",
    ):
        assert private_value not in serialized
    assert "<redacted>" in serialized


@pytest.mark.parametrize(
    ("old_nullable", "new_nullable", "expected"),
    [
        (True, False, MetadataChangeSeverity.BREAKING),
        (None, False, MetadataChangeSeverity.BREAKING),
        (False, True, MetadataChangeSeverity.REVIEW_REQUIRED),
    ],
)
def test_field_nullability_policy(old_nullable, new_nullable, expected):
    asset = make_asset("orders")
    old_field = make_field(asset.asset_id, nullable=old_nullable)
    new_field = make_field(asset.asset_id, nullable=new_nullable)
    diff = compare_metadata_snapshots(
        make_snapshot(assets=[asset], fields=[old_field]),
        make_snapshot(assets=[asset], fields=[new_field]),
    )
    assert changes_of(diff, MetadataChangeKind.FIELD_NULLABILITY_CHANGED)[0].severity == expected


@pytest.mark.parametrize(("old_default", "new_default"), [(None, "0"), ("0", "1")])
def test_default_presence_or_expression_change_requires_review(old_default, new_default):
    asset = make_asset("orders")
    old_field = make_field(asset.asset_id, default_expression=old_default)
    new_field = make_field(asset.asset_id, default_expression=new_default)
    diff = compare_metadata_snapshots(
        make_snapshot(assets=[asset], fields=[old_field]),
        make_snapshot(assets=[asset], fields=[new_field]),
    )
    change = changes_of(diff, MetadataChangeKind.FIELD_DEFAULT_CHANGED)[0]
    assert change.severity == MetadataChangeSeverity.REVIEW_REQUIRED
    assert dict(change.before) == {"default_present": old_default is not None}
    assert dict(change.after) == {"default_present": new_default is not None}


def test_field_ordinal_position_change_requires_review():
    asset = make_asset("orders")
    old_field = make_field(asset.asset_id, ordinal_position=1)
    new_field = make_field(asset.asset_id, ordinal_position=2)
    diff = compare_metadata_snapshots(
        make_snapshot(assets=[asset], fields=[old_field]),
        make_snapshot(assets=[asset], fields=[new_field]),
    )
    change = changes_of(diff, MetadataChangeKind.FIELD_ORDINAL_POSITION_CHANGED)[0]
    assert change.severity == MetadataChangeSeverity.REVIEW_REQUIRED
    assert dict(change.before)["ordinal_position"] == 1
    assert dict(change.after)["ordinal_position"] == 2


def test_field_and_dbt_description_changes_are_metadata_only_and_redacted():
    asset = make_asset("orders")
    old = make_field(asset.asset_id, description="old private description")
    new = make_field(
        asset.asset_id,
        description="new private description",
        dbt_description="secret api_key=do-not-copy",
    )
    diff = compare_metadata_snapshots(
        make_snapshot(assets=[asset], fields=[old]),
        make_snapshot(assets=[asset], fields=[new]),
    )
    change = changes_of(diff, MetadataChangeKind.FIELD_DESCRIPTION_CHANGED)[0]
    serialized = json.dumps(change.to_dict())
    assert change.severity == MetadataChangeSeverity.METADATA_ONLY
    assert "old private description" not in serialized
    assert "new private description" not in serialized
    assert "do-not-copy" not in serialized
    assert set(change.changed_properties) == {"description", "dbt_description"}


def test_asset_description_change_is_metadata_only_without_text():
    old = make_asset("orders", description="old description")
    new = make_asset("orders", description="new description")
    diff = compare_metadata_snapshots(make_snapshot(assets=[old]), make_snapshot(assets=[new]))
    change = changes_of(diff, MetadataChangeKind.ASSET_DESCRIPTION_CHANGED)[0]
    assert change.severity == MetadataChangeSeverity.METADATA_ONLY
    assert "old description" not in json.dumps(change.to_dict())
    assert "new description" not in json.dumps(change.to_dict())


def test_asset_owner_change_requires_review_without_owner_values():
    old = make_asset("orders", owner="alice@example.test")
    new = make_asset("orders", owner="bob@example.test")
    diff = compare_metadata_snapshots(make_snapshot(assets=[old]), make_snapshot(assets=[new]))
    change = changes_of(diff, MetadataChangeKind.OWNER_CHANGED)[0]
    assert change.severity == MetadataChangeSeverity.REVIEW_REQUIRED
    assert "alice" not in json.dumps(change.to_dict())
    assert "bob" not in json.dumps(change.to_dict())


@pytest.mark.parametrize(
    ("old_attributes", "new_attributes", "kind"),
    [
        (
            {"asset_type": "base_table"},
            {"asset_type": "view"},
            MetadataChangeKind.ASSET_TYPE_CHANGED,
        ),
        (
            {"materialization": "table"},
            {"materialization": "view"},
            MetadataChangeKind.MATERIALIZATION_CHANGED,
        ),
    ],
)
def test_asset_type_and_materialization_changes_require_review(
    old_attributes, new_attributes, kind
):
    old = make_asset("orders", **old_attributes)
    new = make_asset("orders", **new_attributes)
    diff = compare_metadata_snapshots(make_snapshot(assets=[old]), make_snapshot(assets=[new]))
    assert changes_of(diff, kind)[0].severity == MetadataChangeSeverity.REVIEW_REQUIRED


def test_source_metadata_change_is_detected_without_copying_values():
    old = make_asset(
        "orders", dbt_unique_id="model.project.orders", source_file="models/orders.sql"
    )
    new = make_asset(
        "orders", dbt_unique_id="model.project.orders", source_file="private/path.sql"
    )
    diff = compare_metadata_snapshots(make_snapshot(assets=[old]), make_snapshot(assets=[new]))
    change = changes_of(diff, MetadataChangeKind.ASSET_SOURCE_METADATA_CHANGED)[0]
    assert change.changed_properties == ("source_file",)
    assert "private/path.sql" not in json.dumps(change.to_dict())


def make_constraint(asset_id, **attributes):
    values = {
        "constraint_name": "orders_pk",
        "constraint_type": "PRIMARY KEY",
        "owning_asset": asset_id,
        "constrained_fields": ("id",),
        "referenced_asset": None,
        "referenced_fields": (),
        "update_rule": None,
        "delete_rule": None,
        "deferrable": False,
        "initially_deferred": False,
        "enforced": True,
    }
    values.update(attributes)
    return Constraint(**values)


def test_constraint_added_removed_and_modified():
    asset = make_asset("orders")
    original = make_constraint(asset.asset_id)
    added = make_constraint(
        asset.asset_id, constraint_name="orders_unique", constraint_type="UNIQUE"
    )
    modified = make_constraint(asset.asset_id, enforced=False)
    base = make_snapshot(assets=[asset])
    added_diff = compare_metadata_snapshots(
        base, make_snapshot(assets=[asset], constraints=[added])
    )
    removed_diff = compare_metadata_snapshots(
        make_snapshot(assets=[asset], constraints=[original]), base
    )
    modified_diff = compare_metadata_snapshots(
        make_snapshot(assets=[asset], constraints=[original]),
        make_snapshot(assets=[asset], constraints=[modified]),
    )
    assert (
        changes_of(added_diff, MetadataChangeKind.CONSTRAINT_ADDED)[0].severity
        == MetadataChangeSeverity.REVIEW_REQUIRED
    )
    assert (
        changes_of(removed_diff, MetadataChangeKind.CONSTRAINT_REMOVED)[0].severity
        == MetadataChangeSeverity.REVIEW_REQUIRED
    )
    change = changes_of(modified_diff, MetadataChangeKind.CONSTRAINT_MODIFIED)[0]
    assert change.severity == MetadataChangeSeverity.REVIEW_REQUIRED
    assert change.changed_properties == ("enforced",)


def test_constraint_type_identity_change_is_remove_and_add():
    asset = make_asset("orders")
    old = make_constraint(asset.asset_id, constraint_type="UNIQUE")
    new = make_constraint(asset.asset_id, constraint_type="CHECK")
    diff = compare_metadata_snapshots(
        make_snapshot(assets=[asset], constraints=[old]),
        make_snapshot(assets=[asset], constraints=[new]),
    )
    assert {change.kind for change in diff.changes} == {
        MetadataChangeKind.CONSTRAINT_ADDED,
        MetadataChangeKind.CONSTRAINT_REMOVED,
    }


def make_lineage(source, target, **attributes):
    values = {
        "source_asset": source,
        "target_asset": target,
        "edge_type": "dbt_parent",
        "transformation_owner": None,
        "evidence_source": None,
        "source_fields": (),
        "target_fields": (),
    }
    values.update(attributes)
    return LineageEdge(**values)


def test_lineage_edge_added_removed_and_modified():
    source, target = make_asset("source"), make_asset("target")
    edge = make_lineage(source.asset_id, target.asset_id)
    modified = make_lineage(source.asset_id, target.asset_id, transformation_owner="dbt")
    base = make_snapshot(assets=[source, target])
    added = compare_metadata_snapshots(
        base, make_snapshot(assets=[source, target], lineage_edges=[edge])
    )
    removed = compare_metadata_snapshots(
        make_snapshot(assets=[source, target], lineage_edges=[edge]), base
    )
    changed = compare_metadata_snapshots(
        make_snapshot(assets=[source, target], lineage_edges=[edge]),
        make_snapshot(assets=[source, target], lineage_edges=[modified]),
    )
    assert (
        changes_of(added, MetadataChangeKind.LINEAGE_EDGE_ADDED)[0].severity
        == MetadataChangeSeverity.NON_BREAKING
    )
    assert (
        changes_of(removed, MetadataChangeKind.LINEAGE_EDGE_REMOVED)[0].severity
        == MetadataChangeSeverity.REVIEW_REQUIRED
    )
    change = changes_of(changed, MetadataChangeKind.LINEAGE_EDGE_MODIFIED)[0]
    assert change.severity == MetadataChangeSeverity.REVIEW_REQUIRED
    assert change.changed_properties == ("transformation_owner",)
    assert dict(change.before)["edge_type"] == "dbt_parent"
    assert '"transformation_owner": "dbt"' not in json.dumps(change.to_dict())


def test_field_level_lineage_modification_is_reported():
    source, target = make_asset("source"), make_asset("target")
    old = make_lineage(source.asset_id, target.asset_id, source_fields=("old_field",))
    new = make_lineage(source.asset_id, target.asset_id, source_fields=("new_field",))
    diff = compare_metadata_snapshots(
        make_snapshot(assets=[source, target], lineage_edges=[old]),
        make_snapshot(assets=[source, target], lineage_edges=[new]),
    )
    change = changes_of(diff, MetadataChangeKind.LINEAGE_EDGE_MODIFIED)[0]
    assert change.changed_properties == ("source_fields",)


def test_changed_lineage_target_seeds_downstream_impact():
    source, target, consumer = (make_asset(name) for name in ("source", "target", "consumer"))
    retained_edge = make_lineage(target.asset_id, consumer.asset_id)
    baseline = make_snapshot(
        assets=[source, target, consumer], lineage_edges=[retained_edge]
    )
    current = make_snapshot(
        assets=[source, target, consumer],
        lineage_edges=[
            make_lineage(source.asset_id, target.asset_id),
            retained_edge,
        ],
    )
    diff = compare_metadata_snapshots(baseline, current)
    assert diff.directly_changed_assets == (target.asset_id,)
    assert diff.downstream_impacted_assets == (consumer.asset_id,)


def test_direct_and_transitive_impact_are_separated():
    first, second, third = (make_asset(name) for name in ("first", "second", "third"))
    edges = [
        make_lineage(first.asset_id, second.asset_id),
        make_lineage(second.asset_id, third.asset_id),
    ]
    baseline = make_snapshot(assets=[first, second, third], lineage_edges=edges)
    current = make_snapshot(
        assets=[first, second, third],
        fields=[make_field(first.asset_id, "new_field")],
        lineage_edges=edges,
    )
    diff = compare_metadata_snapshots(baseline, current)
    assert diff.directly_changed_assets == (first.asset_id,)
    assert diff.downstream_impacted_assets == tuple(sorted((second.asset_id, third.asset_id)))


def test_lineage_cycles_terminate_and_exclude_direct_asset():
    first, second, third = (make_asset(name) for name in ("first", "second", "third"))
    edges = [
        make_lineage(first.asset_id, second.asset_id),
        make_lineage(second.asset_id, third.asset_id),
        make_lineage(third.asset_id, first.asset_id),
    ]
    baseline = make_snapshot(assets=[first, second, third], lineage_edges=edges)
    current = make_snapshot(
        assets=[first, second, third],
        fields=[make_field(first.asset_id, "new_field")],
        lineage_edges=edges,
    )
    diff = compare_metadata_snapshots(baseline, current)
    assert diff.directly_changed_assets == (first.asset_id,)
    assert diff.downstream_impacted_assets == tuple(sorted((second.asset_id, third.asset_id)))


def test_duplicate_edges_across_snapshots_do_not_duplicate_impact():
    source, target = make_asset("source"), make_asset("target")
    edge = make_lineage(source.asset_id, target.asset_id)
    baseline = make_snapshot(assets=[source, target], lineage_edges=[edge])
    current = make_snapshot(
        assets=[source, target],
        fields=[make_field(source.asset_id, "new_field")],
        lineage_edges=[edge],
    )
    diff = compare_metadata_snapshots(baseline, current)
    assert diff.downstream_impacted_assets == (target.asset_id,)


def test_removed_asset_uses_baseline_lineage_for_impact():
    source, target, consumer = (make_asset(name) for name in ("source", "target", "consumer"))
    baseline = make_snapshot(
        assets=[source, target, consumer],
        lineage_edges=[
            make_lineage(source.asset_id, target.asset_id),
            make_lineage(target.asset_id, consumer.asset_id),
        ],
    )
    current = make_snapshot(
        assets=[target, consumer],
        lineage_edges=[make_lineage(target.asset_id, consumer.asset_id)],
    )
    diff = compare_metadata_snapshots(baseline, current)
    assert source.asset_id in diff.directly_changed_assets
    assert target.asset_id in diff.directly_changed_assets
    assert diff.downstream_impacted_assets == (consumer.asset_id,)
    assert source.asset_id not in diff.downstream_impacted_assets
    assert target.asset_id not in diff.downstream_impacted_assets


def test_added_lineage_uses_current_downstream_graph():
    source, target, consumer = (make_asset(name) for name in ("source", "target", "consumer"))
    retained_edge = make_lineage(target.asset_id, consumer.asset_id)
    baseline = make_snapshot(
        assets=[source, target, consumer], lineage_edges=[retained_edge]
    )
    current = make_snapshot(
        assets=[source, target, consumer],
        lineage_edges=[
            make_lineage(source.asset_id, target.asset_id),
            retained_edge,
        ],
    )
    diff = compare_metadata_snapshots(baseline, current)
    assert diff.directly_changed_assets == (target.asset_id,)
    assert diff.downstream_impacted_assets == (consumer.asset_id,)


def test_comparison_and_change_ids_are_deterministic():
    asset = make_asset("orders")
    baseline = make_snapshot(assets=[asset])
    current = make_snapshot(assets=[asset], fields=[make_field(asset.asset_id)])
    first = compare_metadata_snapshots(baseline, current)
    second = compare_metadata_snapshots(baseline, current)
    assert first.comparison_id == second.comparison_id
    assert [change.change_id for change in first.changes] == [
        change.change_id for change in second.changes
    ]


def test_change_output_order_is_stable_across_input_order():
    first, second = make_asset("first"), make_asset("second")
    baseline = make_snapshot(assets=[first, second])
    current_a = make_snapshot(
        assets=[first, second],
        fields=[
            make_field(first.asset_id, "required", nullable=False),
            make_field(second.asset_id),
        ],
    )
    current_b = make_snapshot(
        assets=[second, first],
        fields=[
            make_field(second.asset_id),
            make_field(first.asset_id, "required", nullable=False),
        ],
    )
    a = compare_metadata_snapshots(baseline, current_a)
    b = compare_metadata_snapshots(baseline, current_b)
    assert [change.change_id for change in a.changes] == [change.change_id for change in b.changes]


def test_repeated_serialization_is_byte_equivalent():
    asset = make_asset("orders")
    baseline = make_snapshot(assets=[asset])
    current = make_snapshot(assets=[asset], fields=[make_field(asset.asset_id)])
    first = compare_metadata_snapshots(baseline, current).to_dict()
    second = compare_metadata_snapshots(baseline, current).to_dict()
    assert json.dumps(first, sort_keys=True, separators=(",", ":")) == json.dumps(
        second, sort_keys=True, separators=(",", ":")
    )


@pytest.mark.parametrize("invalid_side", ["baseline", "current"])
def test_invalid_snapshot_is_rejected_without_echoing_content(invalid_side):
    secret = "api_key=never-echo-this"
    good = make_snapshot()
    invalid = make_snapshot(errors=[secret])
    baseline, current = (invalid, good) if invalid_side == "baseline" else (good, invalid)
    with pytest.raises(MetadataIntegrityError) as exc_info:
        compare_metadata_snapshots(baseline, current)
    assert secret not in str(exc_info.value)


@pytest.mark.parametrize("invalid_side", ["baseline", "current"])
def test_stale_checksum_after_mutation_is_rejected(invalid_side):
    asset = make_asset("orders")
    mutated = make_snapshot(assets=[asset])
    mutated.assets.append(make_asset("new_asset"))
    good = make_snapshot(assets=[asset])
    baseline, current = (mutated, good) if invalid_side == "baseline" else (good, mutated)
    with pytest.raises(
        MetadataIntegrityError, match="metadata snapshot failed integrity validation"
    ):
        compare_metadata_snapshots(baseline, current)


def test_free_text_descriptions_and_defaults_never_enter_change_payload():
    asset = make_asset("orders")
    old = make_field(
        asset.asset_id,
        description="student email alice@example.test",
        default_expression="'password=old-secret'",
    )
    new = make_field(
        asset.asset_id,
        description="student email bob@example.test",
        default_expression="'password=new-secret'",
    )
    diff = compare_metadata_snapshots(
        make_snapshot(assets=[asset], fields=[old]),
        make_snapshot(assets=[asset], fields=[new]),
    )
    serialized = json.dumps(diff.to_dict())
    for private_value in ("alice@example.test", "bob@example.test", "old-secret", "new-secret"):
        assert private_value not in serialized
