"""Backward compatibility shim for cli."""

from lotuslearn_pipeline.cli import main  # noqa: F401

if __name__ == "__main__":
    import sys
    sys.exit(main())
