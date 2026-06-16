# Constitution — Personal Meeting NoteTaker

Non-negotiable principles that govern every milestone spec. When a feature spec conflicts with this
document, this document wins.

## Product

1. **Named after the owner.** Brand, the bot's in-meeting display name, and the virtual-cam tile text all
   derive from a single `owner name` setting and are independently overridable. No hard-coded product name.
2. **Self-hosted & data-sovereign.** All meeting data (audio, transcripts, summaries) stays on the owner's
   infrastructure. Recording + transcription run on self-hosted Vexa with LOCAL CPU/GPU Whisper. The only
   permitted external calls are: calendar sources (iCal/ICS, CalDAV) and OpenRouter (summarization).
   Nothing else leaves the box.
3. **v1 = Google Meet only.** Zoom and Microsoft Teams are explicitly out of scope for v1.
4. **No live transcript streaming in v1.** Transcript + summary are produced _after_ the meeting ends.

## Engineering

5. **One Docker Compose stack, environment-parity.** The same images run on Windows/WSL2 (local dev) and on
   the Ubuntu VPS. The only permitted dev/prod differences are: published ports, TLS mode (internal vs
   ACME), `SYNC_MODE` (poll vs push webhook), and resource limits.
6. **All-TypeScript.** Recording + transcription are delegated to self-hosted Vexa (an external engine we
   operate, pinned to a tag); we run no Python service of our own.
7. **Shared schema is the single source of truth.** `packages/db` (Drizzle) is imported by web, worker, and
   mcp. The `settings` table is the single source of truth for runtime configuration.
8. **We do not run our own meeting bot.** Joining + recording + transcription is self-hosted **Vexa**,
   driven over its REST API + WebSocket. Vexa runs as its own pinned Docker Compose project on the shared
   network (CPU Whisper on Windows dev; GPU optional on the VPS).
9. **De-risk first.** The riskiest unknown (the bot joining + recording a real Meet) is validated before any
   UI/AI polish.

## Security

10. **Encrypt secrets at rest.** OAuth/CalDAV tokens are AES-256-GCM envelope-encrypted under a versioned
    `MASTER_ENCRYPTION_KEY`. Recordings are encrypted at rest (object-store SSE in v1).
11. **Least privilege.** No service touches the Docker socket. The Vexa `X-API-Key` is stored AES-GCM-
    encrypted (envelope scheme) and held only in worker memory; the `vexa-driver` role talks to Vexa over
    the private network.
12. **Scoped, hashed API keys.** Programmatic access uses opaque prefixed keys stored only as hashes, with
    per-key scopes, expiry, and revocation. Recordings are served only via short-TTL presigned URLs.
13. **Treat meeting content as untrusted.** Transcript/summary text is never placed in an LLM system prompt
    and is escaped on render (prompt-injection / XSS defense). MCP/AI outputs are data, never instructions.
14. **Audit every sensitive action** (account connect/revoke, dispatch/cancel, settings change, signed-URL
    issuance, key create/revoke, action-item edits).

## Consent / legal

15. **Visible recording disclosure by default.** The bot joins as a clearly-named participant
    ("{Owner} NoteTaker", via Vexa `bot_name`) plus an optional static branded avatar image. Auto-join is
    OFF by default; behavior toward external/unknown participants defaults to announce-only. (Vexa has no
    animated cam tile — disclosure is the visible named participant + avatar.)

## Quality

16. **Pure logic is unit-tested** (Meet-link parsing, auto-join rule engine, action-item JSON parsing, scope
    checks) to ≥90%. **Never call live Google Meet from CI.** The bot is validated via fixture-based pipeline
    smoke tests in CI and manual live runs locally.
17. **Forward-only DB migrations** with a CI drift check; every schema change ships a migration.
