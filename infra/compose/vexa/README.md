# Vexa — self-hosted meeting engine (M2)

We run [Vexa](https://github.com/Vexa-ai/vexa) as a **pinned, separate Docker Compose project** that shares
a Docker network with our stack. Our app drives it over its REST API + WebSocket; we never build or run our
own bot. Our Postgres remains the system of record — Vexa is a replaceable engine.

## Pinned version

- **Tag / VERSION:** `0.10.6.3.14`
- **Commit:** `c0614ca7f9af31440c36792059b1dbc9a2f645c6`
- Images are **prebuilt** on DockerHub (`vexaai/*:latest`) — no build step for the core stack (only the
  CPU transcription worker is built locally).

## Ports (remapped to avoid conflicts on this machine)

Vexa's defaults mostly don't collide, but its **MinIO 9000/9001 conflicts with the existing `rosa-minio`**,
so we remap. Set these in Vexa's root `.env` (copied from `infra/compose/vexa/vexa.env`):

| Service                          | Vexa default | We use   | Why                  |
| -------------------------------- | ------------ | -------- | -------------------- |
| API gateway (user API)           | 8056         | **8056** | free                 |
| Admin API                        | 8057         | **8057** | free                 |
| Runtime API                      | 8090         | 8090     | free                 |
| Postgres (Vexa's own)            | 5458         | 5458     | free (ours is 55432) |
| MinIO API                        | 9000         | **9200** | avoid `rosa-minio`   |
| MinIO console                    | 9001         | **9201** | avoid `rosa-minio`   |
| Dashboard (Vexa's, unused by us) | 3001         | 3001     | free (ours is 3000)  |
| MCP (Vexa's, unused by us)       | 18888        | 18888    | free                 |

## Data sovereignty — local CPU transcription (no GPU)

Vexa's default `TRANSCRIPTION_SERVICE_URL` points at **hosted** `transcription.vexa.ai` (audio leaves the
box). We keep audio **on-box** with the CPU transcription worker:

- `services/transcription-service/docker-compose.cpu.yml` runs `DEVICE=cpu COMPUTE_TYPE=int8` (faster-whisper
  int8). It joins an **external network `vexa-network`** and aliases itself as `transcription-service`.
- The main stack reaches it via `TRANSCRIPTION_SERVICE_URL=http://transcription-service/v1/audio/transcriptions`.
- Set `MODEL_SIZE=tiny` (or `base`) for Windows dev; larger on the VPS. `CPU_THREADS=0` = auto.

> The main stack's compose network is `vexa` (→ real name `vexa_vexa`). The CPU transcription compose
> expects an **external** network literally named `vexa-network`. Bring up procedure below creates that
> shared network and attaches both, so the alias resolves.

## Bring-up (local Windows / WSL2, CPU)

```sh
# 1. Clone Vexa pinned (into a gitignored upstream/ dir)
git clone https://github.com/Vexa-ai/vexa.git infra/compose/vexa/upstream
cd infra/compose/vexa/upstream && git checkout c0614ca7f9af31440c36792059b1dbc9a2f645c6 && cd -

# 2. Shared external network both projects attach to
docker network create vexa-network 2>/dev/null || true

# 3. Vexa env: copy our template to the Vexa repo root and edit the admin token
cp infra/compose/vexa/vexa.env infra/compose/vexa/upstream/.env

# 4. Build + start the CPU transcription worker (first run downloads the model)
cd infra/compose/vexa/upstream/services/transcription-service \
  && MODEL_SIZE=tiny docker compose -f docker-compose.cpu.yml up -d --build && cd -

# 5. Start the Vexa core stack (pulls prebuilt images). Override the compose network to vexa-network
#    OR connect the two networks (see note above). Then:
cd infra/compose/vexa/upstream && make all && cd -

# 6. Verify the API and mint our single user API key
node scripts/vexa.mjs mint   # calls admin API :8057 -> POST /admin/users -> POST /admin/users/{id}/tokens
```

Verify: `curl http://localhost:8056/docs` (Swagger) and `curl http://localhost:8057/docs` (admin). Store
the minted token in our app encrypted (Settings `vexa.api_key`) — it is **non-retrievable** after creation.

## Integration surface our app uses

- `POST /bots` (join), `GET /transcripts/{platform}/{native_meeting_id}` (segments + `.wav` metadata),
  `DELETE /bots/{platform}/{native_meeting_id}` (leave), `GET /bots/status`, WS `ws://…:8056/ws` (live
  `transcript.mutable` + `meeting.status`). Header `X-API-Key` on every call.
- Verify exact field names/enums against live `/docs` before coding the client (M4).

## Status

M2 is **scaffolded and de-risked** (version pinned, ports/network/CPU-transcription wiring locked, key
minting documented). The heavy first boot + the live first recording (M3 — needs a hosted Meet to admit the
bot into) are the next hands-on steps.
