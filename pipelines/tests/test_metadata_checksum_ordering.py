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


def test_checksum_round_trip_survives_sensitive_field_redaction_order_change():
    import lotuslearn_pipeline.metadata as metadata

    sensitive_name = None

    for token in sorted(metadata.PROHIBITED_PII_TOKENS):
        candidate = f"zz_{token}"
        sanitized = metadata._sanitize_metadata_serialization(
            {"field_name": candidate}
        )

        if sanitized["field_name"] == "<redacted>":
            sensitive_name = candidate
            break

    assert sensitive_name is not None

    snapshot = metadata.MetadataSnapshot(
        repository_commit="a" * 40,
        fields=[
            metadata.Field(
                asset_id="asset.test",
                field_name="direction",
                ordinal_position=2,
            ),
            metadata.Field(
                asset_id="asset.test",
                field_name=sensitive_name,
                ordinal_position=3,
            ),
        ],
    )

    serialized = snapshot.to_dict()

    serialized_names = [
        field["field_name"]
        for field in serialized["fields"]
    ]

    assert "direction" in serialized_names
    assert "<redacted>" in serialized_names

    restored = metadata.MetadataSnapshot.from_dict(serialized)

    assert restored.content_checksum == snapshot.content_checksum
    assert restored.compute_checksum() == snapshot.compute_checksum()
    assert restored.to_dict() == serialized
