# Worker image (scheduler / vexa-driver / summarizer / maintenance) + reused for the MCP server.
# Build context = repo root. Runs TypeScript directly via tsx so workspace deps (@pmn/shared,
# @pmn/db) resolve from source — they publish `main: ./src/index.ts`, not a dist build.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app .
WORKDIR /app/services/worker
# Role selected via WORKER_ROLE. The MCP service overrides working_dir + command.
CMD ["node", "--import", "tsx", "src/index.ts"]
