# 001 — Auth + dashboard shell + Settings (M1)

## What & why
A single-owner login, a branded dashboard shell, and a working Settings store — the authenticated frame
every later feature renders inside. The product is named after the owner from here on.

## Acceptance criteria
- [x] Better Auth email+password, single-owner: first sign-up creates the owner; a create hook blocks
      any second sign-up. uuid PKs are DB-generated.
- [x] Unauthenticated dashboard routes redirect to `/login`; first run (no owner) redirects to
      `/onboarding`.
- [x] Sessions are DB-backed and **persist across a server restart** (verified: a session created before
      a restart still authenticates after).
- [x] Onboarding captures the owner's name → drives the brand, the bot's in-meeting name, and the
      recording-tile text (all overridable in Settings).
- [x] Settings persist to the typed `settings` table and the live dashboard reflects them (verified:
      setting `owner_name=Alex` → dashboard brand renders "Alex NoteTaker").
- [x] Production build + full typecheck + unit tests green.

## How
- `apps/web/src/lib/auth.ts` — Better Auth + Drizzle adapter (schema maps user/session/account/
  verification to our tables), `generateId:false`, create-hook owner guard.
- `apps/web/src/lib/settings.ts` — typed `SETTINGS_CATALOG` (single source of truth) + `getSettings` /
  `setSettings` / `resolveBrand` / `resolveBotName`.
- Route groups: `(dashboard)/*` is auth-guarded with the sidebar shell; `/login` + `/onboarding` are
  outside it. Branding (accent, theme) is applied in the dashboard layout from settings.

## Out of scope
Calendar ingestion (M2), the bot (M3+), and the rest of the Settings catalog (recording/consent/AI/
retention/notifications/API), which land with their milestones.
