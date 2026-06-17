import { describe, expect, it } from 'vitest';
import { buildCalendarQueryReport, parseMultiStatus, toICalUtcStamp } from './caldav';

describe('toICalUtcStamp', () => {
  it('formats a UTC stamp', () => {
    expect(toICalUtcStamp(new Date('2026-06-16T13:05:09Z'))).toBe('20260616T130509Z');
  });
});

describe('buildCalendarQueryReport', () => {
  it('embeds the time range and required props', () => {
    const xml = buildCalendarQueryReport(
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-15T00:00:00Z'),
    );
    expect(xml).toContain('calendar-query');
    expect(xml).toContain('<c:calendar-data/>');
    expect(xml).toContain('start="20260601T000000Z"');
    expect(xml).toContain('end="20260615T000000Z"');
    expect(xml).toContain('name="VEVENT"');
  });
});

describe('parseMultiStatus', () => {
  const xml = `<?xml version="1.0"?>
  <d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
    <d:response>
      <d:href>/cal/u/evt1.ics</d:href>
      <d:propstat><d:prop>
        <d:getetag>"abc123"</d:getetag>
        <cal:calendar-data>BEGIN:VCALENDAR&#13;&#10;UID:evt-1&#13;&#10;END:VCALENDAR</cal:calendar-data>
      </d:prop></d:propstat>
    </d:response>
    <d:response>
      <d:href>/cal/u/evt2.ics</d:href>
      <d:propstat><d:prop>
        <d:getetag>"def456"</d:getetag>
        <cal:calendar-data><![CDATA[BEGIN:VCALENDAR
UID:evt-2
END:VCALENDAR]]></cal:calendar-data>
      </d:prop></d:propstat>
    </d:response>
  </d:multistatus>`;

  it('extracts href, etag, and calendar-data for each response', () => {
    const objs = parseMultiStatus(xml);
    expect(objs).toHaveLength(2);
    expect(objs[0]!.href).toBe('/cal/u/evt1.ics');
    expect(objs[0]!.etag).toBe('"abc123"');
    expect(objs[0]!.calendarData).toContain('UID:evt-1');
    expect(objs[0]!.calendarData).toContain('\r\n');
    expect(objs[1]!.calendarData).toContain('UID:evt-2'); // CDATA unwrapped
  });

  it('returns an empty array for an empty multistatus', () => {
    expect(parseMultiStatus('<d:multistatus xmlns:d="DAV:"></d:multistatus>')).toEqual([]);
  });
});
