import path from 'node:path';
import type { NextConfig } from 'next';

// Monorepo root (two levels up from apps/web). Tells Turbopack/file-tracing where the workspace is.
const repoRoot = path.join(import.meta.dirname, '..', '..');

const nextConfig: NextConfig = {
  output: 'standalone',
  // Workspace packages are shipped as TypeScript source; let Next transpile them.
  transpilePackages: ['@pmn/shared', '@pmn/db'],
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
