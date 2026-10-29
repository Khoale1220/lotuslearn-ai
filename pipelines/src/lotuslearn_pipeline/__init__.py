"""LotusLearn Analytical Pipeline Package."""

__version__ = "0.1.0"

from lotuslearn_pipeline.contracts import get_schema_validator, load_canonical_schema
from lotuslearn_pipeline.ingestion import AnalyticalEventValidator, validate_event_batch
from lotuslearn_pipeline.metrics import compute_pipeline_metrics
from lotuslearn_pipeline.models import (
    IngestionBatchSummary,
    IngestionOutcome,
    IngestionResult,
    LearningAnalyticsMetrics,
)
from lotuslearn_pipeline.storage import AnalyticalDatabase, load_sql_resource

__all__ = [
    "load_canonical_schema",
    "get_schema_validator",
    "AnalyticalEventValidator",
    "validate_event_batch",
    "IngestionOutcome",
    "IngestionResult",
    "IngestionBatchSummary",
    "LearningAnalyticsMetrics",
    "AnalyticalDatabase",
    "load_sql_resource",
    "compute_pipeline_metrics",
]
