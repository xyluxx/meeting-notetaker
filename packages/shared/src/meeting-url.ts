import { normalizeMeetUrl } from './meet-link';
import type { VexaPlatform } from './vexa-client';

/**
 * Parse a pasted meeting link (Google Meet, Microsoft Teams, or Zoom) into the fields Vexa needs to
 * send a bot. Mirrors Vexa's own URL parsing. Returns null when the URL isn't a recognized meeting.
 */
export interface ParsedMeeting {
  platform: VexaPlatform;
  nativeMeetingId: string;
  passcode?: string;
  /** Teams only: teams.live.com (consumer) vs teams.microsoft.com (enterprise). */
  teamsBaseHost?: string;
  /** Canonical join URL for display. */
  url: string;
}

const ZOOM_RE = /https?:\/\/(?:[\w-]+\.)?zoom\.us\/(?:j|w|wc\/join)\/(\d{9,12})/i;
const ZOOM_PWD_RE = /[?&]pwd=([^&\s]+)/i;
const TEAMS_LIVE_RE = /https?:\/\/teams\.live\.com\/meet\/(\d{10,15})(?:\?p=([^&\s]+))?/i;
const TEAMS_ENTERPRISE_RE =
  /https?:\/\/(teams\.microsoft\.com|gov\.teams\.microsoft\.us|dod\.teams\.microsoft\.us)\/l\/meetup-join\/([^\s?]+)/i;

export function parseMeetingUrl(input: string | null | undefined): ParsedMeeting | null {
  if (!input) return null;
  const raw = input.trim();

  // Google Meet (reuse the dedicated parser; handles URL or bare code).
  const meet = normalizeMeetUrl(raw);
  if (meet) return { platform: 'google_meet', nativeMeetingId: meet.code, url: meet.url };

  // Teams personal: teams.live.com/meet/<digits>?p=<passcode>
  const tLive = raw.match(TEAMS_LIVE_RE);
  if (tLive?.[1]) {
    return {
      platform: 'teams',
      nativeMeetingId: tLive[1],
      ...(tLive[2] ? { passcode: tLive[2] } : {}),
      teamsBaseHost: 'teams.live.com',
      url: raw,
    };
  }

  // Teams enterprise meetup-join link.
  const tEnt = raw.match(TEAMS_ENTERPRISE_RE);
  if (tEnt?.[2]) {
    return {
      platform: 'teams',
      nativeMeetingId: decodeURIComponent(tEnt[2]),
      teamsBaseHost: tEnt[1]!.toLowerCase(),
      url: raw,
    };
  }

  // Zoom.
  const zoom = raw.match(ZOOM_RE);
  if (zoom?.[1]) {
    const pwd = raw.match(ZOOM_PWD_RE);
    return {
      platform: 'zoom',
      nativeMeetingId: zoom[1],
      ...(pwd?.[1] ? { passcode: pwd[1] } : {}),
      url: raw,
    };
  }

  return null;
}
