"""Transaction retry subsystem for PostgreSQL concurrency failures.

Retries only transaction serialization failures (SQLSTATE 40001) and deadlock
detected errors (SQLSTATE 40P01) using bounded exponential backoff with jitter.
"""

import random
import time
from typing import Any, Callable, NamedTuple, Optional


class RetryExecution(NamedTuple):
    attempts: int
    terminal_sqlstate: Optional[str]
    result: Any


RETRYABLE_SQLSTATES = {"40001", "40P01"}


def is_transient_postgres_error(exc: Exception) -> bool:
    """Returns True if the exception represents a transient concurrency failure (40001 or 40P01)."""
    sqlstate = getattr(exc, "sqlstate", None)
    return sqlstate in RETRYABLE_SQLSTATES


def execute_with_retry(
    operation: Callable[[], Any],
    max_attempts: int = 3,
    base_delay: float = 0.05,
    max_delay: float = 0.5,
    jitter: float = 0.05,
    sleep_fn: Callable[[float], None] = time.sleep,
) -> RetryExecution:
    """
    Executes a callable within bounded retry loop for concurrency conflicts.

    Retries only SQLSTATE 40001 (serialization_failure) and 40P01 (deadlock_detected).
    Never retries business conflicts, schema constraints, or validation errors.
    """
    attempt = 0
    last_sqlstate: Optional[str] = None

    while attempt < max_attempts:
        attempt += 1
        try:
            res = operation()
            return RetryExecution(
                attempts=attempt,
                terminal_sqlstate=None,
                result=res,
            )
        except Exception as exc:
            sqlstate = getattr(exc, "sqlstate", None)
            last_sqlstate = sqlstate

            if sqlstate not in RETRYABLE_SQLSTATES or attempt >= max_attempts:
                # Terminal failure: either non-retryable error or attempts exhausted
                raise exc

            # Bounded exponential backoff + jitter
            delay = min(max_delay, base_delay * (2 ** (attempt - 1))) + random.uniform(0, jitter)
            sleep_fn(delay)

    # Fallback return
    return RetryExecution(
        attempts=attempt,
        terminal_sqlstate=last_sqlstate,
        result=None,
    )
