"""Backward compatibility shim for ingestion."""

from lotuslearn_pipeline.ingestion import (  # noqa: F401
    AnalyticalEventValidator,
    validate_event_batch,
)
