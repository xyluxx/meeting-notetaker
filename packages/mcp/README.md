# @pmn/mcp — Model Context Protocol server (M11)

Read-mostly MCP server over the shared Postgres so the owner's AI agent can query meeting history.
Runs as its own long-lived process and speaks **Streamable HTTP** MCP at `POST /mcp`.

## Tools

| Tool                 | Scope required       | Notes                                   |
| -------------------- | -------------------- | --------------------------------------- |
| `search_meetings`    | `meetings:read`      | recent-first; free-text + status filter |
| `get_meeting`        | `meetings:read`      | one meeting's metadata                  |
| `get_transcript`     | `transcripts:read`   | timestamped, speaker-labelled segments  |
| `get_summary`        | `summaries:read`     | AI summary + key decisions              |
| `list_action_items`  | `action_items:read`  | across meetings or scoped to one        |
| `update_action_item` | `action_items:write` | the **only** write the server allows    |

## Auth & isolation

- **Bearer auth reusing the dashboard API keys** (`mbk_<prefix>.<secret>`, SHA-256-hashed, looked up
  by non-secret prefix, constant-time compare). Mint one in **Settings → API & MCP** with the scopes
  you want the agent to have. No OAuth, no token passthrough — keys are validated locally against our DB.
- **Scope = visibility.** A key only _sees_ (via `tools/list`) the tools its scopes allow, and every
  call re-checks the scope. `action_items:write` implies `action_items:read`.
- **Per-owner.** Every query is filtered by the key's `user_id`; the server never returns cross-owner data.
- **Stateless.** Each request gets a fresh transport + per-key server instance.
- **Untrusted content.** Transcript/summary text is fenced with explicit BEGIN/END markers and labelled
  as data, never instructions — a prompt-injection attempt inside a meeting can't hijack the agent.

## Run

```bash
DATABASE_URL=postgres://... MCP_PORT=8848 pnpm --filter @pmn/mcp dev
# health: GET http://localhost:8848/healthz
# mcp:    POST http://localhost:8848/mcp   (Authorization: Bearer mbk_...)
```

Env: `DATABASE_URL` (required), `MCP_PORT` (default 8848), `MCP_HOST` (default 0.0.0.0).

## Design

Built on the low-level `@modelcontextprotocol/sdk` `Server` with hand-written JSON-Schema tool defs and
our own zod validation, which decouples the SDK from our zod version. Tool dispatch, scope gating, and
formatting all run over a small `MeetingQueries` interface (`queries.ts` is the Drizzle implementation),
so they are unit-tested without a database.
