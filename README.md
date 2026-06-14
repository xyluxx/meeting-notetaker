# NoteTaker — self-hosted meeting recorder + AI dashboard

Records your Google Meet calls, transcribes them, and turns each into an AI summary with tickable action
items — all on your own infrastructure. Named after you.

> Status: **M0 (foundation) in progress.** See the milestone plan in
> `C:\Users\PC\.claude\plans\` and `specs/constitution.md` for the non-negotiables.

## Stack

Next.js 16 · TypeScript · Tailwind v4 · shadcn/ui · Postgres + Drizzle · Redis + BullMQ · Better Auth ·
Caddy · S3-compatible storage (SeaweedFS dev / Garage prod) · own bot (Playwright + Xvfb + PulseAudio +
FFmpeg) · faster-whisper STT · OpenRouter AI. pnpm + Turborepo monorepo.

## Layout

```
apps/web              Next.js: dashboard UI, REST /api/v1, auth, SSE
services/worker       BullMQ consumers (WORKER_ROLE: scheduler | bot-manager | summarizer)
services/bot          Linux-only Meet recording bot (ephemeral container)   [M3/M4]
services/transcription  Python faster-whisper                                [M5]
packages/db           Drizzle schema + migrations (shared backbone)
packages/shared       Pure logic: Meet-link parser, scopes, rule engine, types
packages/mcp          MCP server                                             [M9]
infra/compose         Docker Compose (dev + full), Caddyfile, storage config
specs/                Constitution + per-milestone specs
```

## Prerequisites

- Node 22+ and pnpm (`corepack enable`)
- Docker Desktop with the **WSL2** backend (the bot needs Linux containers)

## Quick start (local, Windows)

```sh
cp .env.example .env          # then edit secrets (BETTER_AUTH_SECRET, MASTER_ENCRYPTION_KEY, ...)
pnpm install
pnpm doctor                   # preflight check
pnpm up                       # bring up Postgres + Redis + object store, run migrations
pnpm dev                      # run web (https://localhost:3000) + worker on the host
```

The dev loop runs web + worker as host processes for speed; only the bot runs in a container. The full
stack (everything in Docker, behind Caddy) is `pnpm up --full` / `node scripts/compose.mjs up --full`,
and is what deploys to the VPS.

## Scripts

| Command                                                   | Does                        |
| --------------------------------------------------------- | --------------------------- |
| `pnpm doctor`                                             | Check Node/pnpm/Docker/.env |
| `pnpm up` / `pnpm down`                                   | Dev infra up/down + migrate |
| `pnpm dev`                                                | Run web + worker (host)     |
| `pnpm typecheck` / `pnpm test:unit` / `pnpm lint`         | Quality gates               |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio` | Drizzle migrations          |

## Scope

v1 = Google Meet only; transcript/summary produced after the call. Deferred: Zoom, Teams, live transcript
streaming, GPU diarization, Google verification/CASA (stay in OAuth Testing mode). See the constitution.
