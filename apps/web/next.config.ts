import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

// Monorepo root (two levels up from apps/web).
const repoRoot = path.join(import.meta.dirname, '..', '..');

// Load the repo-root .env in dev so the Next server sees DATABASE_URL / BETTER_AUTH_SECRET / etc.
// In the prod container, env comes from compose env_file, so the file is absent and this is skipped.
const rootEnv = path.join(repoRoot, '.env');
if (existsSync(rootEnv)) {
  try {
    process.loadEnvFile(rootEnv);
  } catch {
    // best-effort; ignore parse errors
  }
}

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@pmn/shared', '@pmn/db'],
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
  serverExternalPackages: ['postgres'],
};

export default nextConfig;
