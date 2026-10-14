#!/usr/bin/env bash
# Submits one JUnit XML report using only GITHUB_* run metadata and the token input (AC-30).
# Must never echo INPUT_TOKEN: no `set -x`, and curl's command line itself is never printed.
set -euo pipefail

: "${INPUT_URL:?submit-report: missing 'url' input}"
: "${INPUT_TOKEN:?submit-report: missing 'token' input}"
: "${INPUT_FILE:?submit-report: missing 'file' input}"
: "${GITHUB_SHA:?submit-report: GITHUB_SHA is not set}"

# Percent-encodes every byte outside the unreserved set. Works on bytes, not characters,
# so multi-byte UTF-8 (e.g. a branch named "feat/ümlaut") encodes correctly (D-08).
urlencode() {
  local hex byte out=""
  for hex in $(printf '%s' "$1" | od -An -v -tx1); do
    byte=$((16#$hex))
    if { [ "$byte" -ge 48 ] && [ "$byte" -le 57 ]; } ||
      { [ "$byte" -ge 65 ] && [ "$byte" -le 90 ]; } ||
      { [ "$byte" -ge 97 ] && [ "$byte" -le 122 ]; } ||
      [ "$byte" -eq 45 ] || [ "$byte" -eq 46 ] || [ "$byte" -eq 95 ] || [ "$byte" -eq 126 ]; then
      out+="$(printf "\\$(printf '%03o' "$byte")")"
    else
      out+="%$(printf '%02X' "$byte")"
    fi
  done
  printf '%s' "$out"
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
