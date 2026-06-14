# packages/mcp — Model Context Protocol server (built in M9)

Read-mostly MCP tools over the shared data layer so the owner's AI assistant can query meetings:
`search_meetings`, `get_meeting`, `get_transcript`, `get_summary`, `list_action_items`, and one
scope-gated `update_action_item`.

Auth: audience-validated bearer token (a scoped API key with `mcp:*`), **no token passthrough**,
publishes Protected Resource Metadata. Read-only DB role + a narrow write grant on `action_items`.
Transcript/summary text returned to the model is treated as data, never instructions.
