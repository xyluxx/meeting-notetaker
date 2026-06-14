/**
 * API-key scopes. Keys are opaque, hashed, and carry a least-privilege set of these scopes.
 * Recordings are intentionally separate and high-sensitivity (opt-in).
 */
export const API_SCOPES = [
  'meetings:read',
  'meetings:write',
  'transcripts:read',
  'summaries:read',
  'recordings:read',
  'action_items:read',
  'action_items:write',
  'accounts:read',
  'accounts:write',
  'settings:read',
  'settings:write',
  'bot:control',
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

const API_SCOPE_SET: ReadonlySet<string> = new Set(API_SCOPES);

/** Default scopes granted to a newly created key (least privilege). */
export const DEFAULT_KEY_SCOPES: readonly ApiScope[] = ['meetings:read'];

export function isApiScope(value: string): value is ApiScope {
  return API_SCOPE_SET.has(value);
}

/**
 * Returns true when `granted` satisfies `required`. A write scope implies its read scope
 * (e.g. `action_items:write` grants `action_items:read`).
 */
export function hasScope(granted: readonly string[], required: ApiScope): boolean {
  if (granted.includes(required)) return true;
  const implied = WRITE_IMPLIES_READ[required];
  return implied ? granted.includes(implied) : false;
}

/** Returns true when `granted` satisfies every scope in `required`. */
export function hasAllScopes(granted: readonly string[], required: readonly ApiScope[]): boolean {
  return required.every((scope) => hasScope(granted, scope));
}

/** Map of read scopes that are implied by holding the corresponding write scope. */
const WRITE_IMPLIES_READ: Partial<Record<ApiScope, ApiScope>> = {
  'meetings:read': 'meetings:write',
  'action_items:read': 'action_items:write',
  'accounts:read': 'accounts:write',
  'settings:read': 'settings:write',
};
