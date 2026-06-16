# NoteTaker — self-hosted meeting recorder + AI dashboard

Records your Google Meet calls, transcribes them, and turns each into an AI summary with tickable action
items — all on your own infrastructure. Named after you.

> Status: **M0 + M1 shipped.** Built around [Vexa](https://github.com/Vexa-ai/vexa) as the self-hosted
> meeting engine. See the plan in `C:\Users\PC\.claude\plans\` and `specs/constitution.md`.

## Stack

Next.js 16 · TypeScript · Tailwind v4 · Postgres + Drizzle · Redis + BullMQ · Better Auth · Caddy ·
S3-compatible storage (SeaweedFS dev / Garage prod) · **Vexa** (self-hosted engine: joins Meet + records
audio + local Whisper transcription) · OpenRouter AI. pnpm + Turborepo monorepo.

## Layout

```
apps/web              Next.js: dashboard UI, REST /api/v1, auth, SSE
services/worker       BullMQ consumers (WORKER_ROLE: scheduler | vexa-driver | summarizer) + Vexa WS consumer
packages/db           Drizzle schema + migrations (shared backbone)
packages/shared       Pure logic: Meet-link parser, scopes, Vexa client, types
packages/mcp          Our read-mostly MCP server over the DB                  [M11]
infra/compose         Docker Compose (dev + full) + Vexa (pinned), Caddyfile, storage config
specs/                Constitution + per-milestone specs
```

## Prerequisites

- Node 22+ and pnpm (`corepack enable`)
- Docker Desktop with the **WSL2** backend (infra + Vexa run in Linux containers)

## Quick start (local, Windows)

```sh
cp .env.example .env          # then edit secrets (BETTER_AUTH_SECRET, MASTER_ENCRYPTION_KEY, VEXA_*, ...)
pnpm install
pnpm doctor                   # preflight check
pnpm run infra:up             # bring up Postgres + Redis + object store, run migrations
pnpm dev                      # run web (http://localhost:3000) + worker on the host
```

The dev loop runs web + worker as host processes for speed; infra and Vexa run in containers. The full
stack (everything in Docker, behind Caddy) is `node scripts/compose.mjs up --full`, and is what deploys to
the VPS.

## Scripts

| Command                                                   | Does                        |
| --------------------------------------------------------- | --------------------------- |
| `pnpm doctor`                                             | Check Node/pnpm/Docker/.env |
| `pnpm run infra:up` / `infra:down`                        | Dev infra up/down + migrate |
| `pnpm dev`                                                | Run web + worker (host)     |
| `pnpm typecheck` / `pnpm test:unit` / `pnpm lint`         | Quality gates               |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio` | Drizzle migrations          |

## Scope

v1 = Google Meet only; transcript/summary produced after the call. Deferred: Zoom, Teams, live transcript
streaming, GPU diarization, Google verification/CASA (stay in OAuth Testing mode). See the constitution.
