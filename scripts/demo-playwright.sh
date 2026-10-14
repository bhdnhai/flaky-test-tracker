#!/usr/bin/env bash
# `npm run demo:playwright` (FR-35, stretch; ticket #16). Adds a genuinely flaky Playwright
# fixture suite to the same `demo` Project `npm run demo` uses, needing only Docker and git — the
# fixture suite runs inside the official Playwright image, so no host browser install is needed
# for that part (the verification step at the end needs `npx playwright install chromium`, like
# `npm run test:e2e`).
#
# 1. create-project demo, or rotate-token demo if it already exists (same as scripts/demo.sh).
# 2. Runs the Playwright fixture suite 10 times in the `demo-playwright` Compose service, each run
#    producing a fresh JUnit file (one testsuite per browser project) via a bind-mounted volume.
# 3. Submits each JUnit file over the Compose network with the current commit, then polls each
#    Report until it leaves pending/processing.
# 4. Runs the AC-33 verification against the dashboard it just populated.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

PROJECT_NAME=demo
RUNS=10
BASE_URL=http://localhost:8080
COMMIT=$(git rev-parse HEAD)
RUNS_DIR=fixtures/playwright-flaky-suite/runs

# Extracts a top-level string field's value from a single-line JSON object/array on stdin,
# without needing jq or node (matches scripts/demo.sh).
json_string_field() {
  grep -o "\"$1\":\"[^\"]*\"" | head -n1 | cut -d'"' -f4
}

echo "Creating Project \"$PROJECT_NAME\"..."
if OUTPUT=$(docker compose exec -T api node dist/cli.js create-project "$PROJECT_NAME" 2>&1); then
  echo "$OUTPUT"
elif echo "$OUTPUT" | grep -q 'already exists'; then
  echo "Project \"$PROJECT_NAME\" already exists; rotating its token..."
  OUTPUT=$(docker compose exec -T api node dist/cli.js rotate-token "$PROJECT_NAME")
else
  echo "$OUTPUT" >&2
  exit 1
fi
TOKEN=$(echo "$OUTPUT" | tr -d '\r' | tail -n1)

PROJECT_ID=$(curl -sf --retry 10 --retry-delay 1 --retry-connrefused "$BASE_URL/api/v1/projects" \
  | tr ',' '\n' \
  | grep -B1 "\"name\":\"$PROJECT_NAME\"" \
  | json_string_field id)
if [ -z "$PROJECT_ID" ]; then
  echo "Could not find Project \"$PROJECT_NAME\" via $BASE_URL/api/v1/projects" >&2
  exit 1
fi

rm -rf "$RUNS_DIR"
mkdir -p "$RUNS_DIR"

echo "Building the Playwright fixture suite image..."
docker compose --profile demo-playwright build demo-playwright

REPORT_IDS=()
for i in $(seq 1 "$RUNS"); do
  echo "Running the Playwright fixture suite ($i/$RUNS)..."
  docker compose --profile demo-playwright run --rm demo-playwright || true

  RESULT_FILE="$RUNS_DIR/result.xml"
  if [ ! -f "$RESULT_FILE" ]; then
    echo "Run $i produced no JUnit output at $RESULT_FILE" >&2
    exit 1
  fi

  SUBMIT_RESPONSE=$(curl -sf -X POST \
    "$BASE_URL/api/v1/reports?commit=$COMMIT&runId=demo-playwright&runAttempt=$i&job=demo-playwright" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/xml' \
    --data-binary "@$RESULT_FILE")
  REPORT_IDS+=("$(echo "$SUBMIT_RESPONSE" | json_string_field id)")

  mv "$RESULT_FILE" "$RUNS_DIR/run-$i.xml"
done

echo "Waiting for ${#REPORT_IDS[@]} Reports to finish processing..."
for REPORT_ID in "${REPORT_IDS[@]}"; do
  while true; do
    STATE=$(curl -sf "$BASE_URL/api/v1/projects/$PROJECT_ID/reports/$REPORT_ID" \
      | json_string_field processingState)
    case "$STATE" in
      pending | processing) sleep 0.5 ;;
      *) break ;;
    esac
  done
done

echo
echo "Verifying AC-33 against the dashboard..."
npm run test:e2e:demo-playwright --workspace apps/web

echo
echo "Dashboard: $BASE_URL/projects/$PROJECT_ID"
