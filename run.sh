#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dev}"
shift || true

case "$MODE" in
  dev)
    exec docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up "$@"
    ;;
  prod)
    exec docker compose -f docker-compose.yaml up --build "$@"
    ;;
  down)
    exec docker compose -f docker-compose.yaml -f docker-compose.dev.yaml down "$@"
    ;;
  *)
    echo "Usage: $0 {dev|prod|down} [extra docker compose args]"
    exit 1
    ;;
esac
