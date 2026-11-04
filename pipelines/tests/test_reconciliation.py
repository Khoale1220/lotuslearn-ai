"""
Reconciliation tests for LotusLearn ingestion batches.
Validates the invariant: total_attempted == accepted + duplicate + conflict + rejected + failed.
Verifies that internal database retries do not inflate logical ingestion counts.
"""

from lotuslearn_pipeline.models import IngestionOutcome, IngestionResult
from lotuslearn_pipeline.reconciliation import reconcile_batch


def test_reconciliation_balanced_batch():
    """Validates accurate reconciliation of a mixed ingestion batch."""
    results = [
        IngestionResult(
            event_id="e1", outcome=IngestionOutcome.ACCEPTED, event_type="ANALYSIS_INGESTED"
        ),
        IngestionResult(
            event_id="e2", outcome=IngestionOutcome.ACCEPTED, event_type="FINDING_IDENTIFIED"
        ),
        IngestionResult(
            event_id="e3",
            outcome=IngestionOutcome.DUPLICATE,
            rejection_reason="DUPLICATE_EVENT_ID",
            event_type="FINDING_IDENTIFIED",
        ),
        IngestionResult(
            event_id="e4",
            outcome=IngestionOutcome.CONFLICT,
            rejection_reason="IDENTITY_CONFLICT_PAYLOAD_MISMATCH",
            event_type="GROUP_FORMED",
        ),
        IngestionResult(
            event_id="e5",
            outcome=IngestionOutcome.REJECTED,
            rejection_reason="ZERO_PII_VIOLATION",
            event_type="STUDENT_WORK_SUBMITTED",
        ),
    ]

    report = reconcile_batch(
        batch_id="batch-001",
        total_attempted=5,
        results=results,
        retried_attempts=2,  # 2 internal retries were required across the batch
    )

    assert report.total_attempted == 5
    assert report.accepted == 2
    assert report.duplicate == 1
    assert report.conflict == 1
    assert report.rejected == 1
    assert report.failed == 0
    assert report.retried_attempts == 2
    assert report.is_balanced is True
    assert report.imbalance_count == 0

    d = report.to_dict()
    assert d["batch_id"] == "batch-001"
    assert d["is_balanced"] is True


def test_reconciliation_detects_imbalance():
    """Detects when total_attempted does not equal sum of outcomes."""
    results = [
        IngestionResult(event_id="e1", outcome=IngestionOutcome.ACCEPTED),
    ]

    # Stated 3 attempted, but only 1 result provided
    report = reconcile_batch(
        batch_id="batch-002",
        total_attempted=3,
        results=results,
        failed=0,
    )

    assert report.is_balanced is False
    assert report.imbalance_count == 2


def test_internal_retries_do_not_inflate_logical_attempts():
    """
    Demonstrates that transient retries increase retried_attempts
    without inflating total_attempted or corrupting reconciliation balance.
    """
    # 2 logical events were attempted
    results = [
        IngestionResult(event_id="e1", outcome=IngestionOutcome.ACCEPTED),
        IngestionResult(event_id="e2", outcome=IngestionOutcome.ACCEPTED),
    ]

    # Suppose e1 took 2 retries (3 attempts total) and e2 took 1 retry (2 attempts total)
    # Total internal database executions was 5, but logical events attempted was 2
    report = reconcile_batch(
        batch_id="batch-retries",
        total_attempted=2,
        results=results,
        retried_attempts=3,
    )

    assert report.total_attempted == 2
    assert report.accepted == 2
    assert report.retried_attempts == 3
    assert report.is_balanced is True
