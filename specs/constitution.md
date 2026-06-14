# Constitution — Personal Meeting NoteTaker

Non-negotiable principles that govern every milestone spec. When a feature spec conflicts with this
document, this document wins.

## Product

1. **Named after the owner.** Brand, the bot's in-meeting display name, and the virtual-cam tile text all
   derive from a single `owner name` setting and are independently overridable. No hard-coded product name.
2. **Self-hosted & data-sovereign.** All meeting data (recordings, transcripts, summaries) stays on the
   owner's infrastructure. External calls are limited to: Google/CalDAV (calendar/email), Google Meet (the
   bot joining), and OpenRouter (summarization). Nothing else leaves the box.
3. **v1 = Google Meet only.** Zoom and Microsoft Teams are explicitly out of scope for v1.
4. **No live transcript streaming in v1.** Transcript + summary are produced _after_ the meeting ends.

## Engineering

5. **One Docker Compose stack, environment-parity.** The same images run on Windows/WSL2 (local dev) and on
   the Ubuntu VPS. The only permitted dev/prod differences are: published ports, TLS mode (internal vs
   ACME), `SYNC_MODE` (poll vs push webhook), and resource limits.
6. **All-TypeScript** except the transcription service (Python faster-whisper).
7. **Shared schema is the single source of truth.** `packages/db` (Drizzle) is imported by web, worker, and
   mcp. The `settings` table is the single source of truth for runtime configuration.
8. **The bot is Linux-only and always runs in a container** — never as host Node on Windows. One ephemeral
   container per meeting, reaped on exit.
9. **De-risk first.** The riskiest unknown (the bot joining + recording a real Meet) is validated before any
   UI/AI polish.

## Security

10. **Encrypt secrets at rest.** OAuth/CalDAV tokens are AES-256-GCM envelope-encrypted under a versioned
    `MASTER_ENCRYPTION_KEY`. Recordings are encrypted at rest (object-store SSE in v1).
11. **Least privilege.** The bot-runner receives only a one-time callback token and upload-only storage
    creds — never DB credentials or the master key. Only the `bot-manager` worker role touches the Docker
    socket.
12. **Scoped, hashed API keys.** Programmatic access uses opaque prefixed keys stored only as hashes, with
    per-key scopes, expiry, and revocation. Recordings are served only via short-TTL presigned URLs.
13. **Treat meeting content as untrusted.** Transcript/summary text is never placed in an LLM system prompt
    and is escaped on render (prompt-injection / XSS defense). MCP/AI outputs are data, never instructions.
14. **Audit every sensitive action** (account connect/revoke, dispatch/cancel, settings change, signed-URL
    issuance, key create/revoke, action-item edits).

## Consent / legal

15. **Visible recording disclosure by default.** The branded "recording in progress" virtual-cam tile is ON
    by default; auto-join is OFF by default; external/unknown-participant behavior defaults to announce-only.
    These are first-class features, not polish.

## Quality

16. **Pure logic is unit-tested** (Meet-link parsing, auto-join rule engine, action-item JSON parsing, scope
    checks) to ≥90%. **Never call live Google Meet from CI.** The bot is validated via fixture-based pipeline
    smoke tests in CI and manual live runs locally.
17. **Forward-only DB migrations** with a CI drift check; every schema change ships a migration.
