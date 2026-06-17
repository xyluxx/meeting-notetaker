/**
 * Auto-join rule engine (pure). Decides whether the bot should auto-join a meeting, with a clear
 * precedence so the dashboard can explain every decision. Used by the scheduler (M9).
 */
export interface AutoJoinRules {
  /** Master switch. When false, nothing auto-joins (manual dispatch only). */
  globalEnabled: boolean;
  allowDomains?: string[];
  denyDomains?: string[];
  allowEmails?: string[];
  denyEmails?: string[];
  /** If a meeting title contains any of these (case-insensitive), skip it. */
  skipTitleKeywords?: string[];
}

export interface AutoJoinContext {
  /** Explicit per-meeting user choice; wins over everything when set. */
  perMeetingOverride?: boolean | null;
  /** Per-calendar default; falls back to globalEnabled when unset. */
  calendarDefault?: boolean | null;
  organizerEmail?: string | null;
  attendeeEmails?: string[];
  title?: string | null;
  /** A meeting with no join URL can never auto-join. */
  hasMeetUrl: boolean;
}

export interface AutoJoinDecision {
  join: boolean;
  reason: string;
}

function domainOf(email: string): string {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).toLowerCase();
}

function emails(ctx: AutoJoinContext): string[] {
  const list = [...(ctx.attendeeEmails ?? [])];
  if (ctx.organizerEmail) list.push(ctx.organizerEmail);
  return list.map((e) => e.toLowerCase());
}

/** Evaluate the auto-join decision for a meeting. Precedence is documented inline. */
export function evaluateAutoJoin(rules: AutoJoinRules, ctx: AutoJoinContext): AutoJoinDecision {
  if (!ctx.hasMeetUrl) return { join: false, reason: 'no meeting link' };

  // 1. Explicit per-meeting override wins.
  if (ctx.perMeetingOverride === true) return { join: true, reason: 'per-meeting override: join' };
  if (ctx.perMeetingOverride === false)
    return { join: false, reason: 'per-meeting override: skip' };

  // 2. Title keyword skip.
  const title = (ctx.title ?? '').toLowerCase();
  const skipHit = (rules.skipTitleKeywords ?? []).find((k) => k && title.includes(k.toLowerCase()));
  if (skipHit) return { join: false, reason: `title contains "${skipHit}"` };

  const addrs = emails(ctx);
  const domains = addrs.map(domainOf);

  // 3. Deny lists (email or domain) → skip.
  const denyEmail = (rules.denyEmails ?? [])
    .map((e) => e.toLowerCase())
    .find((e) => addrs.includes(e));
  if (denyEmail) return { join: false, reason: `deny-list email ${denyEmail}` };
  const denyDomain = (rules.denyDomains ?? [])
    .map((d) => d.toLowerCase())
    .find((d) => domains.includes(d));
  if (denyDomain) return { join: false, reason: `deny-list domain ${denyDomain}` };

  // 4. Allow lists (if any are configured, require a match).
  const hasAllow = (rules.allowEmails?.length ?? 0) + (rules.allowDomains?.length ?? 0) > 0;
  if (hasAllow) {
    const allowEmail = (rules.allowEmails ?? [])
      .map((e) => e.toLowerCase())
      .some((e) => addrs.includes(e));
    const allowDomain = (rules.allowDomains ?? [])
      .map((d) => d.toLowerCase())
      .some((d) => domains.includes(d));
    if (!allowEmail && !allowDomain) return { join: false, reason: 'not in allow-list' };
  }

  // 5. Fall back to the per-calendar default, then the global switch.
  const fallback = ctx.calendarDefault ?? rules.globalEnabled;
  return fallback
    ? { join: true, reason: hasAllow ? 'matches allow-list' : 'global auto-join on' }
    : { join: false, reason: 'global auto-join off' };
}
