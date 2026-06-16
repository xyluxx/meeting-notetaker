// Vexa helper. See infra/compose/vexa/README.md for the full bring-up (clone/up are documented one-liners).
//   node scripts/vexa.mjs status            # check gateway + admin /docs are reachable
//   node scripts/vexa.mjs mint [email]      # provision one user + mint an X-API-Key (prints it once)
//
// Reads VEXA_BASE_URL / VEXA_ADMIN_URL / VEXA_ADMIN_TOKEN from env (defaults below).
// NOTE: not yet run end-to-end on this machine — verify endpoint/header names against the live
// Swagger at <admin>/docs before relying on it (Vexa's API shifts between releases).
const BASE = process.env.VEXA_BASE_URL ?? 'http://localhost:8056';
const ADMIN = process.env.VEXA_ADMIN_URL ?? 'http://localhost:8057';
const ADMIN_TOKEN = process.env.VEXA_ADMIN_TOKEN ?? 'change-me-strong-admin-token';

const cmd = process.argv[2] ?? 'status';

async function reachable(url) {
  try {
    const res = await fetch(`${url}/docs`, { method: 'GET' });
    return res.status;
  } catch (err) {
    return `unreachable (${err instanceof Error ? err.message : String(err)})`;
  }
}

async function status() {
  console.log(`gateway ${BASE}/docs  -> ${await reachable(BASE)}`);
  console.log(`admin   ${ADMIN}/docs -> ${await reachable(ADMIN)}`);
}

async function mint(email) {
  const headers = { 'Content-Type': 'application/json', 'X-Admin-API-Key': ADMIN_TOKEN };

  const userRes = await fetch(`${ADMIN}/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, name: 'NoteTaker', max_concurrent_bots: 2 }),
  });
  if (!userRes.ok) throw new Error(`create user failed: ${userRes.status} ${await userRes.text()}`);
  const user = await userRes.json();
  console.log(`user id=${user.id} email=${user.email}`);

  const tokRes = await fetch(`${ADMIN}/admin/users/${user.id}/tokens`, { method: 'POST', headers });
  if (!tokRes.ok) throw new Error(`mint token failed: ${tokRes.status} ${await tokRes.text()}`);
  const tok = await tokRes.json();
  console.log('\nVEXA_API_KEY (store encrypted in Settings — shown only once):');
  console.log(tok.token ?? JSON.stringify(tok));
}

const run = cmd === 'mint' ? mint(process.argv[3] ?? 'owner@notetaker.local') : status();
run.catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
