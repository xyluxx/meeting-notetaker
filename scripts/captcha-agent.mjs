// CapSolver CDP agent — clears Google Meet's reCAPTCHA bot-wall on a running Vexa bot WITHOUT
// modifying Vexa. Vexa launches every bot with CDP (9222 -> socat 9223) and the api-gateway proxies
// it at /b/{session_token}/cdp specifically so an agent can "clear captcha/blocking states".
//
//   CAPSOLVER_API_KEY=CAP-... node scripts/captcha-agent.mjs <session_token> <meet_url>
//
// session_token = the `data.session_token` from the POST /bots response.
// NOTE: first live run — the reCAPTCHA token INJECTION into Google's first-party Enterprise widget is
// the uncertain step; expect to iterate against the live page. Connection + solve are deterministic.
import { chromium } from 'playwright-core';

const GATEWAY = process.env.VEXA_GATEWAY ?? 'http://localhost:8056';
const KEY = process.env.CAPSOLVER_API_KEY;
const VEXA_API_KEY = process.env.VEXA_API_KEY; // owning-user key — required by the gateway CDP proxy
const TOKEN = process.argv[2];
const MEET_URL = process.argv[3] ?? '';

if (!KEY) throw new Error('Set CAPSOLVER_API_KEY');
if (!VEXA_API_KEY) throw new Error('Set VEXA_API_KEY (the owning-user key; gateway CDP proxy requires it)');
if (!TOKEN) throw new Error('Usage: node scripts/captcha-agent.mjs <session_token> <meet_url>');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function capsolve(websiteURL, websiteKey) {
  const create = await fetch('https://api.capsolver.com/createTask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientKey: KEY,
      task: { type: 'ReCaptchaV2EnterpriseTaskProxyLess', websiteURL, websiteKey },
    }),
  }).then((r) => r.json());
  if (create.errorId) throw new Error(`CapSolver createTask: ${create.errorCode} ${create.errorDescription}`);
  const taskId = create.taskId;
  console.log(`[capsolver] task ${taskId} created; polling...`);

  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const res = await fetch('https://api.capsolver.com/getTaskResult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: KEY, taskId }),
    }).then((r) => r.json());
    if (res.errorId) throw new Error(`CapSolver getTaskResult: ${res.errorCode} ${res.errorDescription}`);
    if (res.status === 'ready') {
      console.log('[capsolver] solved');
      return res.solution.gRecaptchaResponse;
    }
    process.stdout.write('.');
  }
  throw new Error('CapSolver timed out');
}

async function main() {
  const endpoint = `${GATEWAY}/b/${TOKEN}/cdp`;
  console.log(`[cdp] connecting to ${endpoint}`);
  const browser = await chromium.connectOverCDP(endpoint, {
    headers: { 'X-API-Key': VEXA_API_KEY },
  });

  // Find the page on the Meet domain across all contexts.
  const pages = browser.contexts().flatMap((c) => c.pages());
  console.log(`[cdp] ${pages.length} page(s):`, pages.map((p) => p.url()).join(', '));
  const page = pages.find((p) => /meet\.google\.com|workspace\.google\.com/.test(p.url())) ?? pages[0];
  if (!page) throw new Error('no page found over CDP');
  console.log(`[cdp] using page: ${page.url()}`);

  // Extract the reCAPTCHA site-key from the recaptcha iframe src (?k=SITEKEY).
  const frames = page.frames();
  let siteKey = null;
  for (const f of frames) {
    const m = (f.url() || '').match(/[?&]k=([^&]+)/);
    if ((f.url() || '').includes('/recaptcha/') && m) {
      siteKey = decodeURIComponent(m[1]);
      break;
    }
  }
  if (!siteKey) throw new Error('no reCAPTCHA site-key found on the page (is the bot actually blocked?)');
  console.log(`[recaptcha] site-key: ${siteKey}`);

  const token = await capsolve(MEET_URL || page.url(), siteKey);

  // Inject the token: fill every g-recaptcha-response textarea and try to fire the page's callback.
  const injected = await page.evaluate((tok) => {
    let n = 0;
    document.querySelectorAll('textarea[name="g-recaptcha-response"], #g-recaptcha-response').forEach((el) => {
      el.value = tok;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      n++;
    });
    // Best-effort: invoke any registered enterprise callback.
    try {
      const g = window.grecaptcha?.enterprise ?? window.grecaptcha;
      if (g && typeof g.getResponse === 'function') {
        // no-op read to nudge state
      }
    } catch {}
    return n;
  }, token);
  console.log(`[inject] set token on ${injected} field(s). The bot's admission poll should now proceed.`);

  await browser.close().catch(() => undefined);
}

main().catch((err) => {
  console.error('[captcha-agent]', err instanceof Error ? err.message : err);
  process.exit(1);
});
