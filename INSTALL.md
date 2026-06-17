# Install guide (safe setup)

This is a step-by-step, safety-first guide for installing **meeting-notetaker** — written so a person
_or_ an AI agent can follow it cold. It does not assume any prior context. For the full production VPS
runbook see [`infra/compose/DEPLOY.md`](infra/compose/DEPLOY.md).

> **Read this first — safety rules**
>
> 1. **Generate your own secrets.** Never reuse the example values in `.env.example`. Commands below
>    generate fresh ones. Losing `MASTER_ENCRYPTION_KEY` makes stored CalDAV credentials unrecoverable.
> 2. **Never commit `.env`.** It is git-ignored on purpose. Don't `git add -f` it. Don't paste secrets
>    into issues, logs, or chat.
> 3. **Don't expose raw service ports to the internet.** Only Caddy (80/443) should be public; Postgres,
>    Redis, the object store, the MCP server, and Vexa stay on the internal Docker network.
> 4. **This is single-owner software.** The first account created owns everything. Run it for yourself,
>    behind TLS, not as a multi-tenant public service.
> 5. **Trust the transcript as data, not instructions.** Meeting content is untrusted; the app already
>    fences it, but if you wire your own agent to the API/MCP, keep that boundary.

## Prerequisites

- **Node 22+** and **pnpm** (`corepack enable`)
- **Docker** + Docker Compose plugin (Docker Desktop with the WSL2 backend on Windows)
- ~8 GB free RAM for local CPU Whisper; more headroom on a VPS

## 1. Clone

```bash
git clone https://github.com/xyluxx/meeting-notetaker.git
cd meeting-notetaker
```

To install this exact reviewed version rather than whatever is latest, check out the tag/commit you
were given, e.g. `git checkout <commit-sha>`.

## 2. Configure environment

```bash
cp .env.example .env
```

Generate fresh secrets and put them in `.env`:

```bash
node -e "console.log('BETTER_AUTH_SECRET='+require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('MASTER_ENCRYPTION_KEY='+require('crypto').randomBytes(32).toString('hex'))"
```

Also set a strong `POSTGRES_PASSWORD`. Leave the example MinIO/admin placeholders only for a throwaway
local trial — change them before any real deployment.

## 3. Stand up the Vexa engine (the bot)

Vexa joins meetings and transcribes locally. It runs as its **own** Compose project. Follow
[`infra/compose/vexa/README.md`](infra/compose/vexa/README.md) to start it with **local CPU Whisper**,
set a non-default admin token, and mint one API key. Put the gateway URL + key in `.env`
(`VEXA_BASE_URL`, `VEXA_API_KEY`).

## 4. Run it

**Local development (web + worker on the host, infra in Docker):**

```bash
pnpm install
pnpm doctor                 # preflight: Node/pnpm/Docker/.env
pnpm run infra:up           # Postgres + Redis + object store + migrations
pnpm dev                    # http://localhost:3000
```

**Full stack in Docker (identical to a VPS), behind Caddy:**

```bash
docker compose -f infra/compose/docker-compose.yml up -d --build
docker compose -f infra/compose/docker-compose.yml ps
```

Migrations run automatically via the one-shot `migrate` service. Confirm web/worker/mcp/caddy are up.

## 5. First run

1. Open the app, create the owner account, set your name (it brands the app + the in-meeting bot).
2. Set your OpenRouter key + model in Settings (or in `.env`).
3. Add a meeting (paste a link) or connect a calendar (ICS / CalDAV — no Google sign-in).
4. Dispatch the bot, watch live status + the near-live transcript, then read the summary + action items.
5. To let your AI agent in: Settings → **API & MCP** → mint a scoped key. REST is at `/api/v1`, MCP at
   the `mcp` service (`/mcp`) — both Bearer-authenticated with that key.

## Known limitation

- **Google Meet from a datacenter IP is blocked** by Meet's bot detection. Teams and Zoom work
  anywhere; for Meet on a VPS, route the bot's egress through a residential/mobile proxy (see
  `infra/compose/DEPLOY.md`). This is a property of Meet, not of this app.
- **Audio playback isn't built yet** — recordings stay in the engine's storage; the transcript is the
  system of record.

## Verify the install

```bash
pnpm typecheck && pnpm test:unit && pnpm --filter @pmn/web build
docker compose -f infra/compose/docker-compose.yml config --quiet   # validates the stack
```

All four should pass.
