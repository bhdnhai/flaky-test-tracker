#!/usr/bin/env bash
# THROWAWAY harness. Runs the exact same demo as `npm run demo`, but inside
# `docker run --cpus=0.5` so the flaky-test failure rate can be compared
# between a fast host and a CPU-starved environment (assumption A8).
#
# node_modules is NOT bind-mounted from the host: esbuild/Playwright ship
# platform-specific native binaries, and host node_modules built on macOS
# won't load inside a Linux container. A named volume gives the container
# its own node_modules that persists across runs (first run pays for
# `npm install`; later runs reuse it).
set -euo pipefail
cd "$(dirname "$0")/.."

RUNS="${1:-20}"
VOLUME="reporter-flakiness-proto-node-modules"

echo "docker run --cpus=0.5, ${RUNS} runs per suite variant, concurrency=1 (sequential, to keep the 0.5 CPU cap meaningful)"
echo "First run installs dependencies inside the container; this can take a few minutes."

docker run --rm --cpus=0.5 \
  -v "$(pwd)":/app \
  -v "${VOLUME}":/app/node_modules \
  -w /app \
  node:22-slim \
  bash -c "npm install --no-audit --no-fund --silent && npm run demo -- --runs=${RUNS} --concurrency=1 --label=docker"
