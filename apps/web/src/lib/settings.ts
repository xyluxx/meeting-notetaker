import 'server-only';
import { eq, schema } from '@pmn/db';
import { db } from './db';

/**
 * Settings catalog — the single source of truth for runtime configuration. Each entry declares its
 * group (matches the settings_group enum), value type, default, and a human label. Stored per-owner in
 * the `settings` table; reads merge stored values over these defaults. Extended milestone by milestone.
 */
export type SettingGroup =
  | 'identity'
  | 'auto_join'
  | 'recording'
  | 'consent'
  | 'transcription'
  | 'ai'
  | 'retention'
  | 'notifications';

export type SettingType = 'string' | 'bool' | 'int' | 'enum' | 'json';

export interface SettingDef {
  group: SettingGroup;
  type: SettingType;
  default: unknown;
  label: string;
  description?: string;
  options?: readonly string[];
}

export const SETTINGS_CATALOG = {
  'identity.owner_name': {
    group: 'identity',
    type: 'string',
    default: '',
    label: 'Your name',
    description: 'The product, the bot, and the recording tile are named after you.',
  },
  'identity.brand_name': {
    group: 'identity',
    type: 'string',
    default: '',
    label: 'Brand name',
    description: 'Leave blank to use “{your name} NoteTaker”.',
  },
  'identity.accent': {
    group: 'identity',
    type: 'string',
    default: '#6366F1',
    label: 'Accent color',
  },
  'identity.theme': {
    group: 'identity',
    type: 'enum',
    default: 'system',
    label: 'Theme',
    options: ['light', 'dark', 'system'],
  },
  'identity.bot_display_name': {
    group: 'identity',
    type: 'string',
    default: '',
    label: 'Bot name shown in meetings',
    description: 'Leave blank to use the brand name.',
  },
  'identity.cam_overlay_text': {
    group: 'identity',
    type: 'string',
    default: 'Recording in progress',
    label: 'Recording-tile text',
  },
  'auto_join.global_enabled': {
    group: 'auto_join',
    type: 'bool',
    default: false,
    label: 'Auto-join my meetings',
    description: 'When off, the bot only joins meetings you dispatch manually.',
  },
  'auto_join.lead_seconds': {
    group: 'auto_join',
    type: 'int',
    default: 60,
    label: 'Join lead time (seconds before start)',
  },
  'auto_join.skip_title_keywords': {
    group: 'auto_join',
    type: 'json',
    default: [],
    label: 'Skip meetings whose title contains',
    description: 'Comma-separated keywords; matching meetings are never auto-joined.',
  },
  'auto_join.allow_domains': {
    group: 'auto_join',
    type: 'json',
    default: [],
    label: 'Only auto-join when a participant is from',
    description: 'Email domains (e.g. acme.com). Leave empty to allow all.',
  },
  'auto_join.deny_domains': {
    group: 'auto_join',
    type: 'json',
    default: [],
    label: 'Never auto-join when a participant is from',
    description: 'Email domains to always skip.',
  },
} as const satisfies Record<string, SettingDef>;

export type SettingKey = keyof typeof SETTINGS_CATALOG;
export type SettingsMap = { [K in SettingKey]: unknown };

/** All settings for an owner, defaults merged with stored overrides. */
export async function getSettings(userId: string): Promise<SettingsMap> {
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.userId, userId));
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as SettingsMap;
  for (const key of Object.keys(SETTINGS_CATALOG) as SettingKey[]) {
    out[key] = stored.has(key) ? stored.get(key) : SETTINGS_CATALOG[key].default;
  }
  return out;
}

/** Upsert a batch of settings for an owner. Unknown keys are ignored. */
export async function setSettings(
  userId: string,
  values: Partial<Record<SettingKey, unknown>>,
): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    const def = SETTINGS_CATALOG[key as SettingKey];
    if (!def) continue;
    await db
      .insert(schema.settings)
      .values({ userId, group: def.group, key, value, valueType: def.type })
      .onConflictDoUpdate({
        target: [schema.settings.userId, schema.settings.group, schema.settings.key],
        set: { value, updatedAt: new Date() },
      });
  }
}

/** Resolve the brand name: explicit override, else “{owner} NoteTaker”, else “NoteTaker”. */
export function resolveBrand(settings: SettingsMap): string {
  const brand = String(settings['identity.brand_name'] ?? '').trim();
  if (brand) return brand;
  const owner = String(settings['identity.owner_name'] ?? '').trim();
  return owner ? `${owner} NoteTaker` : 'NoteTaker';
}

/** Resolve the bot's in-meeting display name: explicit override, else the brand. */
export function resolveBotName(settings: SettingsMap): string {
  const bot = String(settings['identity.bot_display_name'] ?? '').trim();
  return bot || resolveBrand(settings);
}
