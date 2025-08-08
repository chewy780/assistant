#!/usr/bin/env bash
set -euo pipefail

if [ ! -f ".env" ]; then
  echo "ERROR: .env missing in $(pwd). Add it with your production secrets."
  exit 1
fi

echo "[deploy] Pulling dependencies and building UI (if any)…"
# Frontend build is handled in CI; we only run compose here.
echo "[deploy] Docker compose up…"
docker compose up -d --build

echo "[deploy] Pruning unused images…"
docker image prune -f

echo "[deploy] Done."
