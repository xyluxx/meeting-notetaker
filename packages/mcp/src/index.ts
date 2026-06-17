import { getDb } from '@pmn/db';
import { startHttpServer } from './http';

/**
 * Entry point for the {Owner} NoteTaker MCP server. Long-lived process; reads DATABASE_URL
 * (via getDb) and serves Streamable HTTP MCP at /mcp behind bearer-key auth.
 */
const port = Number(process.env.MCP_PORT ?? 8848);
const host = process.env.MCP_HOST ?? '0.0.0.0';

startHttpServer({ db: getDb(), port, host });

// eslint-disable-next-line no-console
console.log(`[pmn-mcp] MCP server listening on http://${host}:${port}/mcp`);
