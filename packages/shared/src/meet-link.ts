import type { MeetUrlSource } from './types.js';

/**
 * A Google Meet meeting code looks like `abc-defg-hij` (3-4-3 lowercase letters).
 * We anchor on the canonical host to avoid matching unrelated URLs.
 */
const MEET_CODE = '[a-z]{3}-[a-z]{4}-[a-z]{3}';
const MEET_URL_RE = new RegExp(`https?://meet\\.google\\.com/(${MEET_CODE})`, 'i');
const MEET_CODE_ONLY_RE = new RegExp(`(?:^|\\s)(${MEET_CODE})(?:\\s|$)`);

export interface MeetLinkResult {
  /** Canonical `https://meet.google.com/abc-defg-hij` URL. */
  url: string;
  /** The bare meeting code, e.g. `abc-defg-hij`. */
  code: string;
  /** Where the link was found, for debugging parse drift. */
  source: MeetUrlSource;
}

/** Minimal shape of the parts of a Google Calendar event we read for Meet links. */
export interface CalendarEventLike {
  hangoutLink?: string | null;
  location?: string | null;
  description?: string | null;
  conferenceData?: {
    conferenceSolution?: { key?: { type?: string | null } | null } | null;
    entryPoints?: Array<{
      entryPointType?: string | null;
      uri?: string | null;
    } | null> | null;
  } | null;
}

/** Normalize any string that may contain a Meet URL or bare code into a canonical URL + code. */
export function normalizeMeetUrl(
  input: string | null | undefined,
): { url: string; code: string } | null {
  if (!input) return null;
  const urlMatch = input.match(MEET_URL_RE);
  if (urlMatch?.[1]) {
    const code = urlMatch[1].toLowerCase();
    return { url: `https://meet.google.com/${code}`, code };
  }
  const codeMatch = ` ${input} `.match(MEET_CODE_ONLY_RE);
  if (codeMatch?.[1]) {
    const code = codeMatch[1].toLowerCase();
    return { url: `https://meet.google.com/${code}`, code };
  }
  return null;
}

/**
 * Extract a Google Meet link from a calendar event, preferring the most authoritative source:
 * conferenceData (the real API field) -> hangoutLink (legacy) -> regex over location/description.
 * Returns null when the event has no Meet link.
 */
export function extractMeetLink(event: CalendarEventLike): MeetLinkResult | null {
  // 1. conferenceData.entryPoints[type=video] — the canonical, current source.
  const entryPoints = event.conferenceData?.entryPoints ?? [];
  for (const ep of entryPoints) {
    if (!ep) continue;
    if (ep.entryPointType === 'video' && ep.uri) {
      const norm = normalizeMeetUrl(ep.uri);
      if (norm) return { ...norm, source: 'conferenceData' };
    }
  }

  // 2. hangoutLink — legacy top-level field, still populated for many events.
  const hangout = normalizeMeetUrl(event.hangoutLink);
  if (hangout) return { ...hangout, source: 'hangoutLink' };

  // 3. Last-resort regex over free-text fields (location, then description).
  const fromLocation = normalizeMeetUrl(event.location);
  if (fromLocation) return { ...fromLocation, source: 'regex' };
  const fromDescription = normalizeMeetUrl(event.description);
  if (fromDescription) return { ...fromDescription, source: 'regex' };

  return null;
}

/** True when the event's conferenceData explicitly identifies Google Meet. */
export function isHangoutsMeet(event: CalendarEventLike): boolean {
  return event.conferenceData?.conferenceSolution?.key?.type === 'hangoutsMeet';
}
