# NoteTaker — self-hosted meeting recorder + AI dashboard

Joins your meetings as a bot, records the audio, transcribes it, and turns each call into an AI
**summary with tickable action items** — with live status, lifetime searchable history, and a secure
**REST API + MCP server** so your own AI agent can query it. Everything runs on your own
infrastructure. The product, and the bot that shows up in the meeting, are named after you.

Built around **[Vexa](https://github.com/Vexa-ai/vexa)** (Apache-2.0) as the self-hosted meeting
engine: Vexa joins Google Meet / Microsoft Teams / Zoom as a guest, records audio, and transcribes
locally with Whisper. This app is the brain and system of record (Postgres); Vexa is a replaceable
engine driven over its REST API + WebSocket.

> **Status: feature-complete (M0–M13).** Auth, dashboard, settings, calendars, the full
> dispatch → record → transcribe → summarize pipeline, live status, history, REST API + scoped keys,
> MCP server, retention/notifications, and VPS deploy are all implemented and tested. See
> [`infra/compose/DEPLOY.md`](infra/compose/DEPLOY.md) for the deploy runbook.

## Highlights

- **No Google OAuth.** Calendars are ingested from a pasted meeting link, an **iCal/ICS** subscription
  URL (e.g. Google's private iCal address), or a **CalDAV** collection — nothing to verify, no Gmail scopes.
- **Audio + transcript** (Vexa records `.wav`; no video). Meeting detail = transcript + AI summary +
  action items you can tick off.
- **Live status** via Redis Pub/Sub → SSE as the bot joins, waits in the lobby, and records.
- **Auto-join rules** (global + per-calendar, allow/deny domains, title-skip) decide which meetings the
  bot attends; the scheduler dispatches it at _start − lead_.
- **Your AI agent, first-class.** Scoped, hashed API keys gate a REST `/api/v1` and a read-mostly MCP
  server over your meeting history.
- **Single-owner, self-hosted, data-sovereign.** Local CPU/GPU Whisper; the only outbound calls are your
  calendar sources and OpenRouter (for summaries).

## Stack

Next.js 16 · TypeScript · Tailwind v4 · Postgres + Drizzle · Redis + BullMQ · Better Auth · Caddy ·
S3-compatible storage (SeaweedFS dev / Garage prod) · **Vexa** (self-hosted meeting engine) ·
OpenRouter (model-selectable AI). pnpm + Turborepo monorepo.

## Layout

```
apps/web              Next.js: dashboard UI, REST /api/v1, Better Auth, SSE live status
services/worker       BullMQ roles: scheduler | vexa-driver | summarizer | maintenance
                      (+ persistent Vexa WebSocket consumer for live transcript/status)
packages/db           Drizzle schema + migrations (the system of record)
packages/shared       Pure, tested logic: meeting-URL + iCal/CalDAV parsers, Vexa client,
                      auto-join rules, OpenRouter client, AES-GCM secret box, scopes
packages/mcp          Read-mostly MCP server over the DB for your AI agent
infra/compose         Docker Compose (dev + full stack), Caddyfile, Vexa bring-up + DEPLOY.md
specs/                Constitution + per-milestone specs
```

## Prerequisites

- Node 22+ and pnpm (`corepack enable`)
- Docker Desktop with the **WSL2** backend (infra + Vexa run in Linux containers)

## Quick start (local)

```sh
cp .env.example .env          # set BETTER_AUTH_SECRET, MASTER_ENCRYPTION_KEY, VEXA_*, OPENROUTER_API_KEY
pnpm install
pnpm doctor                   # preflight: Node/pnpm/Docker/.env
pnpm run infra:up             # Postgres + Redis + object store, runs migrations
pnpm dev                      # web on http://localhost:3000 + worker on the host
```

Bring up the Vexa engine separately (its own pinned Compose project) following
[`infra/compose/vexa/README.md`](infra/compose/vexa/README.md). The full stack in Docker behind Caddy —
identical to the VPS deploy — is `docker compose -f infra/compose/docker-compose.yml up -d --build`.

## Scripts

| Command                                                   | Does                        |
| --------------------------------------------------------- | --------------------------- |
| `pnpm doctor`                                             | Check Node/pnpm/Docker/.env |
| `pnpm run infra:up` / `infra:down`                        | Dev infra up/down + migrate |
| `pnpm dev`                                                | Run web + worker (host)     |
| `pnpm typecheck` / `pnpm test:unit` / `pnpm lint`         | Quality gates               |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio` | Drizzle migrations          |

## Platform support & the Google Meet caveat

The bot join + audio recording has been validated end-to-end on **Microsoft Teams**. Teams and Zoom
have no bot wall. **Google Meet** runs invisible reCAPTCHA Enterprise that scores the joining browser on
IP reputation + fingerprint, so joining from a datacenter IP (most VPSs) is blocked unless the bot's
egress goes through a **residential/mobile proxy** (see the note in `infra/compose/DEPLOY.md`). This is a
property of Meet, not of this app — the pipeline is engine- and platform-agnostic.

## License

MIT — see [LICENSE](LICENSE).
