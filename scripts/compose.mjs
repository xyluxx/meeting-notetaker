// Cross-platform compose helper (works the same on Windows/macOS/Linux).
//   node scripts/compose.mjs up        -> bring up dev infra + run migrations
//   node scripts/compose.mjs down      -> stop dev infra
//   node scripts/compose.mjs logs      -> follow dev infra logs
//   add `--full` to target the full stack (infra/compose/docker-compose.yml)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal .env parser so host-run steps (migrate) get DATABASE_URL etc. without a dependency. */
function loadEnv() {
  const envPath = join(root, '.env');
  const out = {};
  if (!existsSync(envPath)) return out;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}
const dotenv = loadEnv();
const args = process.argv.slice(2);
const cmd = args[0] ?? 'up';
const full = args.includes('--full');
const file = full
  ? 'infra/compose/docker-compose.yml'
  : 'infra/compose/docker-compose.dev.yml';

function run(bin, runArgs, opts = {}) {
  const res = spawnSync(bin, runArgs, { stdio: 'inherit', cwd: root, shell: false, ...opts });
  return res.status ?? 1;
}

function dc(extra) {
  const base = ['compose', '-f', file];
  if (existsSync(join(root, '.env'))) base.push('--env-file', '.env');
  return run('docker', [...base, ...extra]);
}

function waitForPostgres() {
  process.stdout.write('Waiting for Postgres to be healthy');
  for (let i = 0; i < 60; i++) {
    const res = spawnSync(
      'docker',
      ['compose', '-f', file, 'exec', '-T', 'postgres', 'pg_isready', '-U', process.env.POSTGRES_USER ?? 'pmn'],
      { cwd: root, stdio: 'ignore', shell: false },
    );
    if (res.status === 0) {
      process.stdout.write(' ready\n');
      return true;
    }
    process.stdout.write('.');
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},1000)']); // ~1s pause, no shell
  }
  process.stdout.write(' timeout\n');
  return false;
}

let status = 0;
switch (cmd) {
  case 'up': {
    status = dc(['up', '-d']);
    if (status === 0 && !full) {
      if (!waitForPostgres()) process.exit(1);
      console.log('Applying migrations...');
      status = run('pnpm', ['db:migrate'], {
        shell: process.platform === 'win32',
        env: { ...process.env, ...dotenv },
      });
    }
    if (status === 0) console.log('\nInfra up. Run `pnpm dev` to start web + worker on the host.');
    break;
  }
  case 'down':
    status = dc(['down']);
    break;
  case 'logs':
    status = dc(['logs', '-f']);
    break;
  case 'ps':
    status = dc(['ps']);
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    status = 1;
}
process.exit(status);
