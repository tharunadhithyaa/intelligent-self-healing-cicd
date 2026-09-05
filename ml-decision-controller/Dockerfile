# syntax=docker/dockerfile:1
FROM python:3.12-slim AS builder

WORKDIR /app

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc-dev

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked \
    pip install --upgrade pip setuptools && \
    pip install --prefix=/install --no-compile --retries 5 --timeout 60 -r requirements.txt

FROM python:3.12-slim AS runner

WORKDIR /app

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    libssl3t64 \
    openssl-provider-legacy

COPY --from=builder /install /usr/local

# Cache-busting argument to force rebuild of app layer without re-installing dependencies
ARG CACHE_DATE=1
COPY app/ /app/app/

RUN addgroup --gid 10001 appgroup && \
    adduser --uid 10001 --ingroup appgroup --disabled-password --gecos "" appuser && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000

ENV PYTHONUNBUFFERED=1 \
    PORT=5000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]
