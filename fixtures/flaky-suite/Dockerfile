# Build context: repository root (see docker-compose.yml). Dependencies are installed here, at
# image build time, so `npm run demo` itself needs no `npm install` (design §10).
FROM node:22.23-alpine
WORKDIR /repo
COPY package.json package-lock.json ./
COPY fixtures/flaky-suite/package.json fixtures/flaky-suite/
RUN npm ci --workspace fixtures/flaky-suite
COPY tsconfig.base.json ./
COPY fixtures/flaky-suite fixtures/flaky-suite
WORKDIR /repo/fixtures/flaky-suite
CMD ["npm", "test"]
