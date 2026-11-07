"""
PostgreSQL integration test validating operational vs dbt mart metric parity.
Skipped when no PostgreSQL URL is provided.
"""

import os
import subprocess
from pathlib import Path

import pytest

TEST_PG_URL = os.environ.get(
    "LOTUSLEARN_DATABASE_URL",
    os.environ.get("LOTUSLEARN_TEST_DATABASE_URL", ""),
)


def test_operational_vs_dbt_metrics_parity():
    """Validates bit-for-bit parity between operational SQL views and dbt analytical marts."""
    if not TEST_PG_URL:
        pytest.skip("No PostgreSQL URL configured for dbt parity test")


    repo_root = Path(__file__).resolve().parent.parent.parent
    script_path = repo_root / "analytics" / "scripts" / "verify_dbt_parity.py"

    proc = subprocess.run(
        ["python3", str(script_path)],
        env={**os.environ, "LOTUSLEARN_DATABASE_URL": TEST_PG_URL},
        capture_output=True,
        text=True,
    )

    assert proc.returncode == 0, f"dbt parity script failed:\n{proc.stdout}\n{proc.stderr}"
    assert "SUCCESS: All operational vs dbt mart parity assertions passed" in proc.stdout
