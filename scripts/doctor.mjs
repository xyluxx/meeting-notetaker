// Preflight check for local development. `node scripts/doctor.mjs`
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let problems = 0;

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function warn(msg) {
  console.log(`  ! ${msg}`);
  problems++;
}

function version(bin, args = ['--version']) {
  const res = spawnSync(bin, args, { encoding: 'utf8', shell: false });
  return res.status === 0 ? (res.stdout || res.stderr).trim().split('\n')[0] : null;
}

console.log('NoteTaker doctor\n');

const node = version(process.execPath);
ok(`node ${node}`);

const pnpm = version('pnpm', ['--version']) ?? version('pnpm.cmd', ['--version']);
pnpm ? ok(`pnpm ${pnpm}`) : warn('pnpm not found — install with `corepack enable`');

const docker = version('docker');
docker ? ok(docker) : warn('docker not found — install Docker Desktop (WSL2 backend)');

const compose = version('docker', ['compose', 'version']);
compose ? ok(compose) : warn('docker compose v2 not available');

existsSync(join(root, '.env'))
  ? ok('.env present')
  : warn('.env missing — copy .env.example to .env and fill in secrets');

console.log(
  problems === 0
    ? '\nAll good. Run `pnpm up` then `pnpm dev`.'
    : `\n${problems} item(s) need attention.`,
);
process.exit(problems === 0 ? 0 : 1);
