#!/usr/bin/env bash
# Integration test for AC-30: runs the composite action's script with fixed GITHUB_* env vars
# against a stub server and asserts the resulting request.
set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
action_dir="$(cd "${test_dir}/.." && pwd)"
repo_root="$(cd "${action_dir}/../../.." && pwd)"
fixture="${repo_root}/apps/api/src/junit/fixtures/vitest-normal-run-01.xml"

tmp="$(mktemp -d)"
port_file="${tmp}/port"
request_file="${tmp}/request.json"

cleanup() {
  [ -n "${server_pid:-}" ] && kill "${server_pid}" 2>/dev/null || true
  rm -rf "${tmp}"
}
trap cleanup EXIT

node "${test_dir}/stub-server.mjs" "${port_file}" "${request_file}" &
server_pid=$!

for _ in $(seq 1 50); do
  [ -s "${port_file}" ] && break
  sleep 0.1
done
[ -s "${port_file}" ] || { echo "AC-30: FAIL — stub server never started"; exit 1; }
port="$(cat "${port_file}")"

export GITHUB_SHA="0123456789abcdef0123456789abcdef01234567"
export GITHUB_REF_NAME="feature/flaky-fix"
export GITHUB_RUN_ID="4242424242"
export GITHUB_RUN_ATTEMPT="2"
export GITHUB_JOB="unit"
export INPUT_URL="http://127.0.0.1:${port}"
export INPUT_TOKEN="ftt_test-token-must-not-be-echoed"
export INPUT_FILE="${fixture}"

output="$("${action_dir}/submit.sh" 2>&1)"

if grep -qF "${INPUT_TOKEN}" <<<"${output}"; then
  echo "AC-30: FAIL — the action must never echo the token"
  exit 1
fi

wait "${server_pid}" 2>/dev/null || true

node "${test_dir}/assert-request.mjs" "${request_file}"
