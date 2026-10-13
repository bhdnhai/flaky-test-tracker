#!/usr/bin/env bash
# `npm run perf:load` (AC-34, NFR-01). Needs `docker compose up -d --build` already running.
# Creates (or reuses) the `perf-load` Project, then runs k6 on the Compose network so
# `BASE_URL` is the `web` service, not localhost (the published port is for the host only).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

PROJECT_NAME=perf-load
HEALTH_URL=http://localhost:8080/health

curl -sf --retry 5 --retry-delay 1 --retry-connrefused "$HEALTH_URL" >/dev/null \
  || { echo "API is not reachable at $HEALTH_URL — run 'docker compose up -d --build' first." >&2; exit 1; }

echo "Creating Project \"$PROJECT_NAME\"..."
if OUTPUT=$(docker compose exec -T api node dist/cli.js create-project "$PROJECT_NAME" 2>&1); then
  :
elif echo "$OUTPUT" | grep -q 'already exists'; then
  echo "Project \"$PROJECT_NAME\" already exists; rotating its token..."
  OUTPUT=$(docker compose exec -T api node dist/cli.js rotate-token "$PROJECT_NAME")
else
  echo "$OUTPUT" >&2
  exit 1
fi
TOKEN=$(echo "$OUTPUT" | tr -d '\r' | tail -n1)

docker compose --profile perf run --rm \
  -e BASE_URL=http://web \
  -e TOKEN="$TOKEN" \
  k6 run /scripts/k6-submit.js
