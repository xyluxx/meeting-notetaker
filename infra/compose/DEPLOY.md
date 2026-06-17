# Deploy — {Owner} NoteTaker on an Ubuntu VPS

Same Compose as local; you only change domains, secrets, and (optionally) the Whisper model.
Target reference: **Contabo VPS40** (48 GB RAM, 12 vCPU) or similar. Two Compose projects share one
Docker network: **ours** (`infra/compose/docker-compose.yml`) and **Vexa** (`infra/compose/vexa/`,
the meeting engine — see `vexa/README.md`).

```
                         ┌──────────────── Caddy (TLS :443) ───────────────┐
   you.example.com  ───▶ │  web (Next.js dashboard + REST /api/v1 + SSE)    │
   mcp.example.com  ───▶ │  mcp (Streamable HTTP MCP for your AI agent)     │
                         └──────────────────────────────────────────────────┘
   workers: scheduler (calendars→joins) · vexa-driver (drives Vexa) · summarizer · maintenance
   stores:  postgres · redis · objectstore (S3)        engine: Vexa (its own compose project)
```

## 10-step runbook

1. **Provision the box.** Ubuntu 22.04/24.04, install Docker Engine + Compose plugin
   (`curl -fsSL https://get.docker.com | sh`). Point DNS `A` records for your dashboard domain and
   `mcp.` subdomain at the VPS. Open ports 80 + 443.

2. **Clone + configure.**

   ```bash
   git clone <repo> notetaker && cd notetaker
   cp .env.example .env
   ```

3. **Generate secrets** (never commit these):

   ```bash
   node -e "console.log('BETTER_AUTH_SECRET='+require('crypto').randomBytes(32).toString('hex'))"
   node -e "console.log('MASTER_ENCRYPTION_KEY='+require('crypto').randomBytes(32).toString('hex'))"
   ```

   Put both in `.env`. Also set a strong `POSTGRES_PASSWORD`.

4. **Set domains + TLS** in `.env`:

   ```
   CADDY_DOMAIN=you.example.com
   CADDY_MCP_DOMAIN=mcp.example.com
   CADDY_TLS_MODE=you@example.com        # ACME email → real Let's Encrypt certs
   APP_URL=https://you.example.com
   NEXT_PUBLIC_APP_URL=https://you.example.com
   BETTER_AUTH_URL=https://you.example.com
   ```

5. **Bring up Vexa** (the engine) first, with **local CPU Whisper** (`base`/`small` on this box;
   GPU optional). Follow `infra/compose/vexa/README.md` to start it, set a non-default admin token,
   and mint one user API key. Put the gateway URL + key in `.env`:

   ```
   VEXA_BASE_URL=http://vexa-gateway:8056
   VEXA_WS_URL=ws://vexa-gateway:8056/ws
   VEXA_API_KEY=<minted key>
   VEXA_WHISPER_MODEL=base
   ```

6. **Start our stack** (migrations run automatically via the one-shot `migrate` service):

   ```bash
   docker compose -f infra/compose/docker-compose.yml up -d --build
   docker compose -f infra/compose/docker-compose.yml ps
   ```

   Confirm `migrate` exited 0 and web/workers/mcp/caddy are healthy.

7. **Onboard.** Visit `https://you.example.com`, create the owner account, set your name (drives the
   brand + the bot's in-meeting display name "{You} NoteTaker"). Set your OpenRouter key + model in
   Settings if you didn't put it in `.env`.

8. **Add a calendar.** Calendars → paste a Meet/Teams/Zoom link, or add an **iCal/ICS** subscription
   URL (e.g. Google's private "Secret address in iCal format") or a **CalDAV** collection URL +
   credentials. Turn on auto-join (globally in Settings, or per-calendar) and set the lead time.

9. **Verify a meeting end-to-end.** Dispatch a bot (or let the scheduler do it). Watch live status
   (`joining → waiting_lobby → recording`), admit the bot from the meeting lobby, talk, end the call.
   The meeting detail then shows the transcript, AI summary, and tickable action items.

10. **Wire your AI agent.** Settings → **API & MCP** → mint a scoped key. REST:
    `https://you.example.com/api/v1/...` with `Authorization: Bearer mbk_…`. MCP:
    `https://mcp.example.com/mcp` with the same bearer. Confirm a wrong-scope key gets 403.

## Operations

- **Retention.** Settings → `retention.days` (0 = keep forever). The `maintenance` worker purges
  meetings (and their transcripts/summaries/recordings) older than the cutoff, hourly.
- **Notifications.** Set `notifications.webhook_url` to receive a JSON summary POST when a meeting
  finishes processing (sent once per meeting; recorded in `notifications`).
- **Backups.** Snapshot the `pg_data` and `objstore_data` volumes. Postgres is the system of record.
- **Upgrades.** `git pull && docker compose -f infra/compose/docker-compose.yml up -d --build`.
  Re-verify Vexa endpoints if you bump its pinned tag (see `vexa/README.md`).

## Google Meet bot-blocking (important)

Meet runs invisible reCAPTCHA Enterprise that scores the joining browser on **IP reputation** +
**fingerprint**. Datacenter IPs (most VPSs) score badly and the bot is wedged at the lobby. Mitigations:

- Run Vexa's browser egress through a **residential/mobile proxy**, and apply the WebGL/anti-detect
  patch in `infra/compose/vexa/patches/`.
- **Teams and Zoom have no equivalent wall** and work from the VPS as-is — prefer them where possible.
- Org-only Meet meetings block guests entirely regardless of fingerprint; those can't be auto-joined.

Audio-only is expected (Vexa records `.wav` + transcript, no video) — by design for v1.
