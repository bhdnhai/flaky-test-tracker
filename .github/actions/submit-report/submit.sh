#!/usr/bin/env bash
# Submits one JUnit XML report using only GITHUB_* run metadata and the token input (AC-30).
# Must never echo INPUT_TOKEN: no `set -x`, and curl's command line itself is never printed.
set -euo pipefail

: "${INPUT_URL:?submit-report: missing 'url' input}"
: "${INPUT_TOKEN:?submit-report: missing 'token' input}"
: "${INPUT_FILE:?submit-report: missing 'file' input}"
: "${GITHUB_SHA:?submit-report: GITHUB_SHA is not set}"

urlencode() {
  local string="$1" length i c
  length="${#string}"
  for ((i = 0; i < length; i++)); do
    c="${string:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) printf '%s' "$c" ;;
      *) printf '%%%02X' "'$c" ;;
    esac
  done
}

query="commit=$(urlencode "${GITHUB_SHA}")"
[ -n "${GITHUB_REF_NAME:-}" ] && query="${query}&branch=$(urlencode "${GITHUB_REF_NAME}")"
[ -n "${GITHUB_RUN_ID:-}" ] && query="${query}&runId=$(urlencode "${GITHUB_RUN_ID}")"
[ -n "${GITHUB_RUN_ATTEMPT:-}" ] && query="${query}&runAttempt=$(urlencode "${GITHUB_RUN_ATTEMPT}")"
[ -n "${GITHUB_JOB:-}" ] && query="${query}&job=$(urlencode "${GITHUB_JOB}")"

curl --fail-with-body --silent --show-error \
  --request POST \
  "${INPUT_URL%/}/api/v1/reports?${query}" \
  --header "Authorization: Bearer ${INPUT_TOKEN}" \
  --header "Content-Type: application/xml" \
  --data-binary "@${INPUT_FILE}"
