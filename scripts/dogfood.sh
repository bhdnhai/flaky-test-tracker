#!/usr/bin/env bash
# `dogfood` CI job (FR-34, design §11). Creates a Project, then after the fixture suite is run
# and submitted through the composite action, asserts the Report processed with this run's
# commit and `runAttempt` (AC-31). The re-run comparison itself happens on real GitHub
# infrastructure; see ticket #14's Comments for the recorded evidence.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

BASE_URL=http://localhost:8080
PROJECT_NAME=dogfood
RUNS_DIR=fixtures/flaky-suite/runs

cmd_setup() {
  curl -sf --retry 10 --retry-delay 1 --retry-connrefused "$BASE_URL/api/v1/projects" > /dev/null

  OUTPUT=$(docker compose exec -T api node dist/cli.js create-project "$PROJECT_NAME")
  TOKEN=$(echo "$OUTPUT" | tr -d '\r' | tail -n1)

  PROJECT_ID=$(curl -sf "$BASE_URL/api/v1/projects" | node -e '
    const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const match = data.items.find((p) => p.name === process.argv[1]);
    if (!match) process.exit(1);
    process.stdout.write(match.id);
  ' "$PROJECT_NAME")

  rm -rf "$RUNS_DIR"
  mkdir -p "$RUNS_DIR"

  : "${GITHUB_OUTPUT:?dogfood setup: GITHUB_OUTPUT is not set}"
  # Mask before the token reaches any step output or input, so GitHub redacts it in logs (NFR-06, D-05).
  echo "::add-mask::$TOKEN"
  {
    echo "token=$TOKEN"
    echo "project_id=$PROJECT_ID"
  } >> "$GITHUB_OUTPUT"
}

cmd_assert() {
  local project_id="$1"
  : "${GITHUB_SHA:?dogfood assert: GITHUB_SHA is not set}"
  : "${GITHUB_RUN_ATTEMPT:?dogfood assert: GITHUB_RUN_ATTEMPT is not set}"

  echo "Waiting for the Report to finish processing..."
  REPORT=""
  for _ in $(seq 1 60); do
    REPORT=$(curl -sf "$BASE_URL/api/v1/projects/$project_id/reports" | node -e '
      const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
      const match = data.items.find((r) => r.commitSha === process.argv[1]);
      process.stdout.write(match ? JSON.stringify(match) : "");
    ' "$GITHUB_SHA")

    if [ -n "$REPORT" ]; then
      STATE=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).processingState)' "$REPORT")
      case "$STATE" in
        pending | processing) ;;
        *) break ;;
      esac
    fi
    sleep 1
  done

  if [ -z "$REPORT" ]; then
    echo "No Report found for commit $GITHUB_SHA" >&2
    exit 1
  fi

  node -e '
    const report = JSON.parse(process.argv[1]);
    const expectedAttempt = process.argv[2];
    if (report.processingState !== "processed") {
      console.error(`AC-31: expected processingState "processed", got "${report.processingState}"`);
      process.exit(1);
    }
    if (String(report.runAttempt) !== String(expectedAttempt)) {
      console.error(`AC-31: expected runAttempt ${expectedAttempt}, got ${report.runAttempt}`);
      process.exit(1);
    }
    console.log(
      `AC-31: Report ${report.id} processed with commit ${report.commitSha}, runAttempt ${report.runAttempt}`,
    );
  ' "$REPORT" "$GITHUB_RUN_ATTEMPT"
}

case "${1:-}" in
  setup) cmd_setup ;;
  assert) cmd_assert "${2:?Usage: $0 assert <project-id>}" ;;
  *)
    echo "Usage: $0 {setup|assert <project-id>}" >&2
    exit 1
    ;;
esac
