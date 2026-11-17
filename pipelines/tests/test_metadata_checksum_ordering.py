from lotuslearn_pipeline.metadata import Field, MetadataSnapshot


def test_checksum_is_stable_when_equal_primary_field_keys_change_order():
    """Canonical checksum ordering must be total, not insertion-order dependent."""

    first = Field(
        asset_id="asset:test",
        field_name="duplicate_name",
        ordinal_position=1,
        physical_data_type="integer",
        normalized_type="integer",
        nullable=False,
    )
    second = Field(
        asset_id="asset:test",
        field_name="duplicate_name",
        ordinal_position=2,
        physical_data_type="bigint",
        normalized_type="integer",
        nullable=True,
    )

    snapshot = MetadataSnapshot(fields=[first, second])

    serialized = snapshot.to_dict()
    serialized["fields"] = list(reversed(serialized["fields"]))

    restored = MetadataSnapshot.from_dict(serialized)

    assert restored.content_checksum == snapshot.content_checksum
    assert restored.compute_checksum() == snapshot.compute_checksum()
    assert restored._checksum_payload() == snapshot._checksum_payload()
