# 000 — Foundation (M0)

## What & why
Stand up the monorepo, shared data model, and one-command local infrastructure so every later milestone
has a reproducible base. No product behavior yet — this is the skeleton everything hangs off.

## Acceptance criteria
- [x] `pnpm install` resolves the workspace (apps/web, services/worker, packages/db, packages/shared).
- [x] `pnpm typecheck` passes for all packages.
- [x] `pnpm test:unit` passes (shared logic: Meet-link parser, scopes — 14 tests).
- [x] `pnpm --filter @pmn/web build` produces a standalone Next.js build.
- [x] `pnpm run infra:up` brings up Postgres + Redis + object store and applies the Drizzle migration
      to a fresh DB (15 tables verified).
- [x] `pnpm run infra:down && pnpm run infra:up` is idempotent.
- [x] CI workflow runs format + typecheck + unit + migration drift check (configured; runs on push).

## Out of scope (later milestones)
Auth & dashboard (M1), calendar sync (M2), the bot (M3/M4), transcription (M5), AI (M6), live status
(M7), scheduler (M8), API/MCP (M9), CalDAV (M10), Gmail (M11), retention (M12), VPS deploy (M13).

## Notes
- Dev loop runs web + worker as host processes; only the bot runs in a container.
- Object storage: SeaweedFS in dev (simple single-process S3), Garage/S3 on the VPS.
- Migration drift check (`pnpm db:generate` produces no diff) guards the forward-only migration rule.
