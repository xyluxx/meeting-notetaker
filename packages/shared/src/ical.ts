import { type ParsedMeeting, parseMeetingUrl } from './meeting-url';

/**
 * Focused RFC 5545 (iCalendar) parser for VEVENTs. Used to ingest ICS subscription feeds and CalDAV
 * calendar-data. No external dependency: line unfolding, property/param parsing, timezone-aware date
 * parsing (IANA TZID via Intl), and bounded recurrence expansion. Pure and unit-tested.
 */

export interface VEvent {
  uid: string;
  summary: string | null;
  description: string | null;
  location: string | null;
  url: string | null;
  /** Absolute start (UTC) or null when unparseable. */
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  status: string | null;
  organizerEmail: string | null;
  attendeeEmails: string[];
  rrule: string | null;
  /** RECURRENCE-ID present → this VEVENT overrides a single occurrence. */
  recurrenceId: Date | null;
  sequence: number;
}

interface RawProp {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** RFC 5545 line unfolding: a line beginning with space/tab continues the previous line. */
export function unfoldIcs(text: string): string[] {
  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parsePropLine(line: string): RawProp | null {
  const colon = indexOfUnquoted(line, ':');
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments = splitUnquoted(head, ';');
  const name = segments[0]!.toUpperCase();
  const params: Record<string, string> = {};
  for (const seg of segments.slice(1)) {
    const eq = seg.indexOf('=');
    if (eq === -1) continue;
    params[seg.slice(0, eq).toUpperCase()] = stripQuotes(seg.slice(eq + 1));
  }
  return { name, params, value };
}

function indexOfUnquoted(s: string, ch: string): number {
  let inQuote = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '"') inQuote = !inQuote;
    else if (c === ch && !inQuote) return i;
  }
  return -1;
}

function splitUnquoted(s: string, ch: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQuote = false;
  for (const c of s) {
    if (c === '"') inQuote = !inQuote;
    if (c === ch && !inQuote) {
      parts.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  parts.push(cur);
  return parts;
}

function stripQuotes(s: string): string {
  return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

/** Unescape TEXT values (\\n \\, \\; \\,). */
function unescapeText(s: string): string {
  return s.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

/* -------------------------------------------------------------------------- */
/* Timezone-aware date parsing                                                 */
/* -------------------------------------------------------------------------- */

/** Offset (ms) of `tz` from UTC at the given instant, via Intl. */
function tzOffsetMs(instantMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(instantMs))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(
    parts.year!,
    parts.month! - 1,
    parts.day!,
    parts.hour!,
    parts.minute!,
    parts.second!,
  );
  return asUtc - instantMs;
}

/** Convert a wall-clock time in `tz` to the absolute UTC instant. */
function zonedWallToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  tz: string,
): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  try {
    const off1 = tzOffsetMs(guess, tz);
    let utc = guess - off1;
    const off2 = tzOffsetMs(utc, tz);
    if (off2 !== off1) utc = guess - off2;
    return new Date(utc);
  } catch {
    return new Date(guess); // unknown TZID → treat as UTC
  }
}

interface ParsedDate {
  date: Date | null;
  allDay: boolean;
}

export function parseICalDate(value: string, tzid?: string): ParsedDate {
  const dateOnly = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    return { date: new Date(Date.UTC(+y!, +mo! - 1, +d!)), allDay: true };
  }
  const dt = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!dt) return { date: null, allDay: false };
  const [, y, mo, d, h, mi, s, z] = dt;
  const nums = [+y!, +mo!, +d!, +h!, +mi!, +s!] as const;
  if (z === 'Z') {
    return {
      date: new Date(Date.UTC(nums[0], nums[1] - 1, nums[2], nums[3], nums[4], nums[5])),
      allDay: false,
    };
  }
  if (tzid) {
    return {
      date: zonedWallToUtc(nums[0], nums[1], nums[2], nums[3], nums[4], nums[5], tzid),
      allDay: false,
    };
  }
  // Floating local time — best-effort, treat as UTC.
  return {
    date: new Date(Date.UTC(nums[0], nums[1] - 1, nums[2], nums[3], nums[4], nums[5])),
    allDay: false,
  };
}

function emailFromCalAddress(value: string): string | null {
  const m = value.match(/mailto:([^\s;]+)/i);
  return m ? m[1]!.toLowerCase() : null;
}

/* -------------------------------------------------------------------------- */
/* VEVENT parsing                                                              */
/* -------------------------------------------------------------------------- */

/** Parse all VEVENTs out of an iCalendar document. Ignores VTIMEZONE/VALARM blocks. */
export function parseICalendar(text: string): VEvent[] {
  const lines = unfoldIcs(text);
  const events: VEvent[] = [];
  let cur: Partial<VEvent> & { attendeeEmails: string[] } = { attendeeEmails: [] };
  let depth = 0; // nested component depth inside a VEVENT (e.g. VALARM)
  let inEvent = false;

  for (const line of lines) {
    const prop = parsePropLine(line);
    if (!prop) continue;
    if (prop.name === 'BEGIN' && prop.value === 'VEVENT') {
      inEvent = true;
      depth = 0;
      cur = { attendeeEmails: [], sequence: 0 };
      continue;
    }
    if (!inEvent) continue;
    if (prop.name === 'END' && prop.value === 'VEVENT') {
      if (cur.uid) {
        events.push({
          uid: cur.uid,
          summary: cur.summary ?? null,
          description: cur.description ?? null,
          location: cur.location ?? null,
          url: cur.url ?? null,
          start: cur.start ?? null,
          end: cur.end ?? null,
          allDay: cur.allDay ?? false,
          status: cur.status ?? null,
          organizerEmail: cur.organizerEmail ?? null,
          attendeeEmails: cur.attendeeEmails,
          rrule: cur.rrule ?? null,
          recurrenceId: cur.recurrenceId ?? null,
          sequence: cur.sequence ?? 0,
        });
      }
      inEvent = false;
      continue;
    }
    if (prop.name === 'BEGIN') {
      depth++;
      continue;
    }
    if (prop.name === 'END') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0) continue; // inside VALARM etc.

    switch (prop.name) {
      case 'UID':
        cur.uid = prop.value;
        break;
      case 'SUMMARY':
        cur.summary = unescapeText(prop.value);
        break;
      case 'DESCRIPTION':
        cur.description = unescapeText(prop.value);
        break;
      case 'LOCATION':
        cur.location = unescapeText(prop.value);
        break;
      case 'URL':
        cur.url = prop.value;
        break;
      case 'STATUS':
        cur.status = prop.value.toUpperCase();
        break;
      case 'SEQUENCE':
        cur.sequence = Number(prop.value) || 0;
        break;
      case 'RRULE':
        cur.rrule = prop.value;
        break;
      case 'DTSTART': {
        const { date, allDay } = parseICalDate(prop.value, prop.params.TZID);
        cur.start = date;
        cur.allDay = allDay;
        break;
      }
      case 'DTEND': {
        cur.end = parseICalDate(prop.value, prop.params.TZID).date;
        break;
      }
      case 'RECURRENCE-ID':
        cur.recurrenceId = parseICalDate(prop.value, prop.params.TZID).date;
        break;
      case 'ORGANIZER':
        cur.organizerEmail = emailFromCalAddress(prop.value);
        break;
      case 'ATTENDEE': {
        const email = emailFromCalAddress(prop.value);
        if (email) cur.attendeeEmails.push(email);
        break;
      }
    }
  }
  return events;
}

/* -------------------------------------------------------------------------- */
/* Meeting-URL extraction                                                      */
/* -------------------------------------------------------------------------- */

const URL_RE = /https?:\/\/[^\s<>"')]+/gi;

/** Find the first recognized meeting URL (Meet/Teams/Zoom) anywhere in free text. */
export function extractMeetingUrlFromText(text: string | null | undefined): ParsedMeeting | null {
  if (!text) return null;
  const candidates = text.match(URL_RE);
  if (!candidates) return null;
  for (const c of candidates) {
    const parsed = parseMeetingUrl(c.replace(/[.,;]+$/, ''));
    if (parsed) return parsed;
  }
  return null;
}

/** Resolve a VEVENT's join URL from URL, then LOCATION, then DESCRIPTION. */
export function extractEventMeeting(event: VEvent): ParsedMeeting | null {
  return (
    extractMeetingUrlFromText(event.url) ??
    extractMeetingUrlFromText(event.location) ??
    extractMeetingUrlFromText(event.description)
  );
}

/* -------------------------------------------------------------------------- */
/* Recurrence expansion (bounded window)                                       */
/* -------------------------------------------------------------------------- */

interface RRule {
  freq: string;
  interval: number;
  count: number | null;
  until: Date | null;
  byday: number[]; // 0=SU..6=SA
}

const WEEKDAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export function parseRRule(rrule: string): RRule {
  const parts: Record<string, string> = {};
  for (const seg of rrule.split(';')) {
    const eq = seg.indexOf('=');
    if (eq > 0) parts[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1);
  }
  const byday = (parts.BYDAY ?? '')
    .split(',')
    .map((d) => WEEKDAYS[d.replace(/^[+-]?\d+/, '').toUpperCase()])
    .filter((d): d is number => d !== undefined);
  let until: Date | null = null;
  if (parts.UNTIL) until = parseICalDate(parts.UNTIL).date;
  return {
    freq: (parts.FREQ ?? '').toUpperCase(),
    interval: Math.max(1, Number(parts.INTERVAL) || 1),
    count: parts.COUNT ? Number(parts.COUNT) : null,
    until,
    byday,
  };
}

const MAX_ITERATIONS = 1000;

/**
 * Occurrence start times for an event within [windowStart, windowEnd] (inclusive). Non-recurring
 * events yield their single start if it falls in the window. Supports DAILY/WEEKLY/MONTHLY/YEARLY
 * with INTERVAL/COUNT/UNTIL and BYDAY (weekly).
 */
export function expandOccurrences(event: VEvent, windowStart: Date, windowEnd: Date): Date[] {
  if (!event.start) return [];
  if (!event.rrule) {
    return event.start >= windowStart && event.start <= windowEnd ? [event.start] : [];
  }
  const rule = parseRRule(event.rrule);
  const out: Date[] = [];
  const startMs = event.start.getTime();
  const winStart = windowStart.getTime();
  const winEnd = windowEnd.getTime();
  let emitted = 0;

  const push = (ms: number): boolean => {
    if (rule.until && ms > rule.until.getTime()) return false;
    if (rule.count !== null && emitted >= rule.count) return false;
    emitted++;
    if (ms >= winStart && ms <= winEnd) out.push(new Date(ms));
    return true;
  };

  if (rule.freq === 'WEEKLY' && rule.byday.length > 0) {
    // Walk week by week; within each active week emit the configured weekdays.
    const base = new Date(startMs);
    const baseDow = base.getUTCDay();
    const weekStartMs = startMs - baseDow * 86_400_000; // Sunday of the start week, at start's time
    for (let w = 0, iter = 0; iter < MAX_ITERATIONS; w += rule.interval, iter++) {
      const weekMs = weekStartMs + w * 7 * 86_400_000;
      if (weekMs > winEnd + 7 * 86_400_000) break;
      let stop = false;
      for (const dow of [...rule.byday].sort((a, b) => a - b)) {
        const ms = weekMs + dow * 86_400_000;
        if (ms < startMs) continue;
        if (!push(ms)) {
          stop = true;
          break;
        }
      }
      if (stop) break;
      if (rule.count !== null && emitted >= rule.count) break;
    }
    return out.sort((a, b) => a.getTime() - b.getTime());
  }

  const step = (i: number): number => {
    const d = new Date(startMs);
    const n = i * rule.interval;
    switch (rule.freq) {
      case 'DAILY':
        d.setUTCDate(d.getUTCDate() + n);
        break;
      case 'WEEKLY':
        d.setUTCDate(d.getUTCDate() + n * 7);
        break;
      case 'MONTHLY':
        d.setUTCMonth(d.getUTCMonth() + n);
        break;
      case 'YEARLY':
        d.setUTCFullYear(d.getUTCFullYear() + n);
        break;
      default:
        return Number.NaN;
    }
    return d.getTime();
  };

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const ms = step(i);
    if (Number.isNaN(ms)) break;
    if (ms > winEnd) break;
    if (!push(ms)) break;
  }
  return out;
}
