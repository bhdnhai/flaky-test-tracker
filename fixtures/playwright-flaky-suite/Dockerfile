# Build context: repository root (see docker-compose.yml). Based on the official Playwright
# image, which already has chromium and firefox installed, so `npm run demo:playwright` needs no
# host browser install (ticket #16; the alternative documented in the README is running this
# suite directly on the host after `npx playwright install chromium firefox`).
FROM mcr.microsoft.com/playwright:v1.64.0-noble
WORKDIR /repo
COPY package.json package-lock.json ./
COPY fixtures/playwright-flaky-suite/package.json fixtures/playwright-flaky-suite/
RUN npm ci --workspace fixtures/playwright-flaky-suite
COPY tsconfig.base.json ./
COPY fixtures/playwright-flaky-suite fixtures/playwright-flaky-suite
WORKDIR /repo/fixtures/playwright-flaky-suite
CMD ["npm", "test"]
