"""Data structures and types for the LotusLearn analytical pipeline."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class IngestionOutcome(str, Enum):
    ACCEPTED = "accepted"
    DUPLICATE = "duplicate"
    REJECTED = "rejected"


@dataclass(frozen=True)
class IngestionResult:
    event_id: str
    outcome: IngestionOutcome
    rejection_reason: Optional[str] = None
    event_type: Optional[str] = None


@dataclass
class IngestionBatchSummary:
    total_received: int = 0
    accepted_count: int = 0
    duplicate_count: int = 0
    rejected_count: int = 0
    results: List[IngestionResult] = field(default_factory=list)

    @property
    def is_successful(self) -> bool:
        return self.rejected_count == 0


@dataclass
class LearningAnalyticsMetrics:
    total_accepted_events: int
    distinct_students_count: int
    total_analysis_runs: int
    findings_by_concept: List[Dict[str, Any]]
    prevalence_by_cluster: List[Dict[str, Any]]
    educator_modification_rate: Optional[float]
