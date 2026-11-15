FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY pipelines/pyproject.toml pipelines/README.md /build/pipelines/
COPY pipelines/src/ /build/pipelines/src/

RUN python -m pip install --no-cache-dir /build/pipelines

USER 65532:65532

EXPOSE 9108

ENTRYPOINT ["python", "-m", "lotuslearn_pipeline.execution_exporter"]
