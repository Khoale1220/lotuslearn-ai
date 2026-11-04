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
from lotuslearn_pipeline.postgres import (
    AnalysisRunConflictError,
    MigrationDriftError,
    MigrationFileMissingError,
    PostgresAnalyticalDatabase,
    apply_postgres_migrations,
    get_migration_status,
)
from lotuslearn_pipeline.reconciliation import ReconciliationReport, reconcile_batch
from lotuslearn_pipeline.retry import (
    RetryExecution,
    execute_with_retry,
    is_transient_postgres_error,
)
from lotuslearn_pipeline.storage import (
    AnalyticalDatabase,
    get_database,
    load_sql_resource,
)

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
    "PostgresAnalyticalDatabase",
    "apply_postgres_migrations",
    "get_migration_status",
    "MigrationDriftError",
    "MigrationFileMissingError",
    "AnalysisRunConflictError",
    "execute_with_retry",
    "is_transient_postgres_error",
    "RetryExecution",
    "reconcile_batch",
    "ReconciliationReport",
    "get_database",
    "load_sql_resource",
    "compute_pipeline_metrics",
]
