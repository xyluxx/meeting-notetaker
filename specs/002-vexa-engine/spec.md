# 002 — Vexa meeting engine (M2)

## What & why

Adopt self-hosted [Vexa](https://github.com/Vexa-ai/vexa) as the joining/recording/transcription engine
so we never build or maintain our own bot. Our app drives Vexa over its REST API + WebSocket and remains the
system of record. This milestone stands Vexa up locally (CPU, on-box) and mints the one API key our worker
uses.

## Locked decisions (from inspection of the pinned repo)

- **Pinned:** Vexa `0.10.6.3.14`, commit `c0614ca7f9af31440c36792059b1dbc9a2f645c6`. Core images are
  prebuilt (`vexaai/*:latest`) — only the CPU transcription worker builds locally.
- **Run mode:** full compose (`make all`) — gives the api-gateway (`:8056`) + admin-api (`:8057`) +
  runtime-api our app integrates with. (Lite needs an external Postgres + transcription; not used.)
- **On-box transcription (no GPU):** `services/transcription-service/docker-compose.cpu.yml`
  (`DEVICE=cpu COMPUTE_TYPE=int8`, faster-whisper), `MODEL_SIZE=tiny` for Windows dev. It joins an external
  `vexa-network` and aliases as `transcription-service`; main stack uses
  `TRANSCRIPTION_SERVICE_URL=http://transcription-service/v1/audio/transcriptions`.
- **Port remap:** MinIO → host `9200/9201` (avoid the existing `rosa-minio` on 9000/9001). Others unchanged
  (`8056/8057/8090/5458`).
- **Auth:** admin API (`:8057`, header `X-Admin-API-Key` = `ADMIN_TOKEN`) mints a non-retrievable user
  `X-API-Key` → stored AES-GCM-encrypted in our Settings (`vexa.api_key`).

## Acceptance criteria

- [ ] `docker network create vexa-network`; CPU transcription worker built + up (model `tiny`).
- [ ] Vexa core stack up via `make all` on the shared network; `ADMIN_TOKEN` changed off `changeme`.
- [ ] `node scripts/vexa.mjs status` shows gateway `:8056/docs` + admin `:8057/docs` reachable.
- [ ] `node scripts/vexa.mjs mint` returns a user API key; stored encrypted in Settings.
- [ ] `docker stats` captured to size CPU/RAM for 1–2 concurrent bots.

## Deliverables (this milestone)

- `infra/compose/vexa/README.md` — exact bring-up runbook (done).
- `infra/compose/vexa/vexa.env` — our Vexa env template (CPU transcription, remapped ports) (done).
- `scripts/vexa.mjs` — `status` + `mint` helpers (done; verify against live `/docs`).
- `infra/compose/vexa/upstream/` — pinned Vexa checkout (gitignored).

## Risks

Version drift (mitigated by the pin + reading live `/docs`); CPU Whisper speed (use `tiny`/`base`, measure);
the `vexa` vs `vexa-network` network-name seam (the runbook creates the shared external network). The first
boot pulls ~10 images + builds the CPU worker (downloads a Whisper model) — minutes, not seconds.

## Next (M3)

Manually drive a real Google Meet via Vexa REST: `POST /bots` with `bot_name="{Owner} NoteTaker"`, admit the
bot from the lobby, then `GET /transcripts` → segments + `.wav`. Needs a hosted Meet to admit the bot into.
