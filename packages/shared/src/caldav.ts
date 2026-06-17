/**
 * Minimal CalDAV (RFC 4791) helpers: build a `calendar-query` REPORT body for a time window and
 * parse the multistatus response into per-event calendar-data (ICS). Pure + unit-tested. The HTTP
 * glue (PROPFIND/REPORT with Basic auth) lives in the worker. We require the user to supply the
 * calendar *collection* URL directly, so no principal/home-set discovery is needed for v1.
 */

export interface CalDavObject {
  href: string;
  etag: string | null;
  /** Raw VCALENDAR text (one or more VEVENTs). */
  calendarData: string | null;
}

/** iCalendar UTC stamp `YYYYMMDDTHHMMSSZ`. */
export function toICalUtcStamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`
  );
}

/** Build a `calendar-query` REPORT body restricted to VEVENTs in [start, end). */
export function buildCalendarQueryReport(start: Date, end: Date): string {
  return [
    '<?xml version="1.0" encoding="utf-8" ?>',
    '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">',
    '  <d:prop><d:getetag/><c:calendar-data/></d:prop>',
    '  <c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">',
    `    <c:time-range start="${toICalUtcStamp(start)}" end="${toICalUtcStamp(end)}"/>`,
    '  </c:comp-filter></c:comp-filter></c:filter>',
    '</c:calendar-query>',
  ].join('\n');
}

function unescapeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#13;/g, '\r')
    .replace(/&#10;/g, '\n')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Match an element by local name, ignoring namespace prefix. Returns inner content of the first. */
function innerByLocalName(xml: string, local: string): string | null {
  const re = new RegExp(
    `<(?:[\\w-]+:)?${local}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${local}>`,
    'i',
  );
  const m = xml.match(re);
  return m ? m[1]! : null;
}

/** Parse a CalDAV/WebDAV multistatus body into one entry per `<response>`. */
export function parseMultiStatus(xml: string): CalDavObject[] {
  const responseRe = /<(?:[\w-]+:)?response(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w-]+:)?response>/gi;
  const out: CalDavObject[] = [];
  for (const match of xml.matchAll(responseRe)) {
    const block = match[1]!;
    const href = innerByLocalName(block, 'href');
    const etag = innerByLocalName(block, 'getetag');
    const data = innerByLocalName(block, 'calendar-data');
    out.push({
      href: href ? unescapeXml(href).trim() : '',
      etag: etag ? unescapeXml(etag).trim() : null,
      calendarData: data ? unescapeXml(data).trim() : null,
    });
  }
  return out;
}
