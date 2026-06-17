import {
  type IncomingMessage,
  type Server as NodeServer,
  type ServerResponse,
  createServer,
} from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { type Database, eq, schema } from '@pmn/db';
import { type KeyLookup, authenticate } from './auth';
import { createDbQueries } from './queries';
import { createMcpServer } from './server';

const MCP_PATH = '/mcp';
const JSON_HEADERS = { 'content-type': 'application/json' } as const;

/** JSON-RPC error envelope (id null — these are transport/auth errors, not tool errors). */
function rpcError(code: number, message: string): string {
  return JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null });
}

/** DB-backed key lookup by non-secret prefix. */
function dbKeyLookup(db: Database): KeyLookup {
  return async (prefix) => {
    const [row] = await db
      .select({
        userId: schema.apiKeys.userId,
        hash: schema.apiKeys.hash,
        scopes: schema.apiKeys.scopes,
        revokedAt: schema.apiKeys.revokedAt,
        expiresAt: schema.apiKeys.expiresAt,
      })
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.prefix, prefix))
      .limit(1);
    return row ?? null;
  };
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err as Error);
      }
    });
    req.on('error', reject);
  });
}

export interface HttpServerOptions {
  db: Database;
  port: number;
  host?: string;
}

/**
 * Start the MCP HTTP server. Stateless: each request is bearer-authenticated, then handled by a
 * fresh transport + per-key MCP server, so a key only ever sees its owner's data.
 */
export function startHttpServer(opts: HttpServerOptions): NodeServer {
  const lookup = dbKeyLookup(opts.db);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');

      if (req.method === 'GET' && url.pathname === '/healthz') {
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify({ ok: true, server: 'pmn-mcp' }));
        return;
      }

      if (url.pathname !== MCP_PATH) {
        res.writeHead(404, JSON_HEADERS);
        res.end(rpcError(-32004, 'Not found'));
        return;
      }

      const authed = await authenticate(req.headers.authorization, lookup);
      if (!authed) {
        res.writeHead(401, { ...JSON_HEADERS, 'www-authenticate': 'Bearer realm="pmn-mcp"' });
        res.end(rpcError(-32001, 'Unauthorized: provide a valid API key as a Bearer token.'));
        return;
      }

      const parsedBody = req.method === 'POST' ? await readBody(req) : undefined;
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const mcp = createMcpServer({
        queries: createDbQueries(opts.db),
        userId: authed.userId,
        scopes: authed.scopes,
      });
      res.on('close', () => {
        void transport.close();
        void mcp.close();
      });
      await mcp.connect(transport);
      await transport.handleRequest(req, res, parsedBody);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(400, JSON_HEADERS);
        res.end(rpcError(-32700, `Bad request: ${(err as Error).message}`));
      }
    }
  });

  server.listen(opts.port, opts.host ?? '0.0.0.0');
  return server;
}
