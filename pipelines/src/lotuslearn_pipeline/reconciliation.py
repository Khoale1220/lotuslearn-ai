"""Batch reconciliation subsystem for LotusLearn analytical pipeline.

Verifies identity accounting balance:
total_attempted == accepted + duplicate + conflict + rejected + failed
Internal concurrency transaction retries must never inflate logical attempted count.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from lotuslearn_pipeline.models import IngestionOutcome, IngestionResult


@dataclass
class ReconciliationReport:
    batch_id: str = ""
    total_attempted: int = 0
    accepted_count: int = 0
    duplicate_count: int = 0
    conflict_count: int = 0
    rejected_count: int = 0
    failed_count: int = 0
    internal_retry_count: int = 0
    results: List[IngestionResult] = field(default_factory=list)

    @property
    def accepted(self) -> int:
        return self.accepted_count

    @property
    def duplicate(self) -> int:
        return self.duplicate_count

    @property
    def conflict(self) -> int:
        return self.conflict_count

    @property
    def rejected(self) -> int:
        return self.rejected_count

    @property
    def failed(self) -> int:
        return self.failed_count

    @property
    def retried_attempts(self) -> int:
        return self.internal_retry_count

    @property
    def imbalance_count(self) -> int:
        accounted = (
            self.accepted_count
            + self.duplicate_count
            + self.conflict_count
            + self.rejected_count
            + self.failed_count
        )
        return abs(self.total_attempted - accounted)

    @property
    def is_balanced(self) -> bool:
        """Confirms that all logical outcomes sum precisely to total_attempted."""
        accounted = (
            self.accepted_count
            + self.duplicate_count
            + self.conflict_count
            + self.rejected_count
            + self.failed_count
        )
        return self.total_attempted == accounted

    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "total_attempted": self.total_attempted,
            "accepted": self.accepted_count,
            "duplicate": self.duplicate_count,
            "conflict": self.conflict_count,
            "rejected": self.rejected_count,
            "failed": self.failed_count,
            "retried_attempts": self.internal_retry_count,
            "is_balanced": self.is_balanced,
            "imbalance_count": self.imbalance_count,
        }

    def format_summary(self) -> str:
        status = "BALANCED" if self.is_balanced else "UNBALANCED"
        lines = [
            f"--- Batch Reconciliation Audit [{status}] ---",
            f"Batch ID:             {self.batch_id}",
            f"Total Attempted:      {self.total_attempted}",
            f"Accepted:             {self.accepted_count}",
            f"Duplicates:           {self.duplicate_count}",
            f"Conflicts:            {self.conflict_count}",
            f"Rejected:             {self.rejected_count}",
            f"Failed:               {self.failed_count}",
            f"Internal Retries:     {self.internal_retry_count}",
            f"Accounting Check:     {'PASS' if self.is_balanced else 'FAIL'}",
        ]
        return "\n".join(lines)


def reconcile_batch(
    results: List[IngestionResult],
    total_attempted: Optional[int] = None,
    batch_id: str = "",
    retried_attempts: int = 0,
    internal_retry_count: int = 0,
    failed: Optional[int] = None,
) -> ReconciliationReport:
    """Computes an exact reconciliation report from a list of ingestion results."""
    effective_attempted = len(results) if total_attempted is None else total_attempted
    effective_retries = max(retried_attempts, internal_retry_count)

    report = ReconciliationReport(
        batch_id=batch_id,
        total_attempted=effective_attempted,
        internal_retry_count=effective_retries,
        results=results,
    )

    for r in results:
        if r.outcome == IngestionOutcome.ACCEPTED:
            report.accepted_count += 1
        elif r.outcome == IngestionOutcome.DUPLICATE:
            report.duplicate_count += 1
        elif r.outcome == IngestionOutcome.CONFLICT:
            report.conflict_count += 1
        elif r.outcome == IngestionOutcome.REJECTED:
            if r.rejection_reason and "TRANSACTION_FAILED" in r.rejection_reason:
                report.failed_count += 1
            else:
                report.rejected_count += 1

    if failed is not None:
        report.failed_count = failed

    return report
