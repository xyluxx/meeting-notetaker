import { describe, expect, it } from 'vitest';
import {
  type VEvent,
  expandOccurrences,
  extractEventMeeting,
  parseICalDate,
  parseICalendar,
  parseRRule,
  unfoldIcs,
} from './ical';

const SAMPLE = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:evt-1@example.com',
  'SUMMARY:Weekly sync with the',
  '  product team',
  'DESCRIPTION:Join here https://meet.google.com/abc-defg-hij please',
  'DTSTART:20260616T130000Z',
  'DTEND:20260616T133000Z',
  'ORGANIZER;CN=Boss:mailto:boss@example.com',
  'ATTENDEE:mailto:Alice@Example.com',
  'STATUS:CONFIRMED',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:evt-2@example.com',
  'SUMMARY:All-day offsite',
  'DTSTART;VALUE=DATE:20260620',
  'LOCATION:https://example.com/not-a-meeting',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('unfoldIcs', () => {
  it('joins folded continuation lines', () => {
    const lines = unfoldIcs('SUMMARY:Weekly sync with the\r\n  product team\r\n');
    expect(lines[0]).toBe('SUMMARY:Weekly sync with the product team');
  });
});

describe('parseICalDate', () => {
  it('parses UTC date-times', () => {
    expect(parseICalDate('20260616T130000Z').date?.toISOString()).toBe('2026-06-16T13:00:00.000Z');
  });

  it('parses date-only as all-day UTC midnight', () => {
    const r = parseICalDate('20260620');
    expect(r.allDay).toBe(true);
    expect(r.date?.toISOString()).toBe('2026-06-20T00:00:00.000Z');
  });

  it('converts a TZID wall time to UTC (America/New_York, EDT = -4h)', () => {
    const r = parseICalDate('20260616T090000', 'America/New_York');
    expect(r.date?.toISOString()).toBe('2026-06-16T13:00:00.000Z');
  });
});

describe('parseICalendar', () => {
  it('parses multiple VEVENTs with folded lines, attendees, and organizer', () => {
    const events = parseICalendar(SAMPLE);
    expect(events).toHaveLength(2);
    const [a, b] = events;
    expect(a!.uid).toBe('evt-1@example.com');
    expect(a!.summary).toBe('Weekly sync with the product team');
    expect(a!.organizerEmail).toBe('boss@example.com');
    expect(a!.attendeeEmails).toEqual(['alice@example.com']);
    expect(a!.start?.toISOString()).toBe('2026-06-16T13:00:00.000Z');
    expect(b!.allDay).toBe(true);
  });
});

describe('extractEventMeeting', () => {
  it('finds a Meet link in the description', () => {
    const [evt] = parseICalendar(SAMPLE);
    const meeting = extractEventMeeting(evt!);
    expect(meeting?.platform).toBe('google_meet');
    expect(meeting?.nativeMeetingId).toBe('abc-defg-hij');
  });

  it('returns null when no meeting URL is present', () => {
    const events = parseICalendar(SAMPLE);
    expect(extractEventMeeting(events[1]!)).toBeNull();
  });
});

function evt(over: Partial<VEvent>): VEvent {
  return {
    uid: 'u',
    summary: null,
    description: null,
    location: null,
    url: null,
    start: null,
    end: null,
    allDay: false,
    status: null,
    organizerEmail: null,
    attendeeEmails: [],
    rrule: null,
    exdates: [],
    recurrenceId: null,
    sequence: 0,
    ...over,
  };
}

describe('parseRRule', () => {
  it('parses freq/interval/count/byday', () => {
    const r = parseRRule('FREQ=WEEKLY;INTERVAL=2;COUNT=5;BYDAY=MO,WE');
    expect(r.freq).toBe('WEEKLY');
    expect(r.interval).toBe(2);
    expect(r.count).toBe(5);
    expect(r.byday).toEqual([1, 3]);
  });
});

describe('expandOccurrences', () => {
  const winStart = new Date('2026-06-01T00:00:00Z');
  const winEnd = new Date('2026-06-30T23:59:59Z');

  it('returns the single start for non-recurring events in-window', () => {
    const e = evt({ start: new Date('2026-06-16T13:00:00Z') });
    expect(expandOccurrences(e, winStart, winEnd)).toHaveLength(1);
  });

  it('excludes non-recurring events outside the window', () => {
    const e = evt({ start: new Date('2026-07-16T13:00:00Z') });
    expect(expandOccurrences(e, winStart, winEnd)).toHaveLength(0);
  });

  it('expands DAILY with COUNT', () => {
    const e = evt({ start: new Date('2026-06-10T08:00:00Z'), rrule: 'FREQ=DAILY;COUNT=3' });
    const occ = expandOccurrences(e, winStart, winEnd);
    expect(occ.map((d) => d.toISOString())).toEqual([
      '2026-06-10T08:00:00.000Z',
      '2026-06-11T08:00:00.000Z',
      '2026-06-12T08:00:00.000Z',
    ]);
  });

  it('expands WEEKLY BYDAY within the window', () => {
    // 2026-06-01 is a Monday. Every Mon & Wed.
    const e = evt({ start: new Date('2026-06-01T09:00:00Z'), rrule: 'FREQ=WEEKLY;BYDAY=MO,WE' });
    const occ = expandOccurrences(e, winStart, new Date('2026-06-10T23:59:59Z'));
    expect(occ.map((d) => d.toISOString())).toEqual([
      '2026-06-01T09:00:00.000Z',
      '2026-06-03T09:00:00.000Z',
      '2026-06-08T09:00:00.000Z',
      '2026-06-10T09:00:00.000Z',
    ]);
  });

  it('honors UNTIL', () => {
    const e = evt({
      start: new Date('2026-06-10T08:00:00Z'),
      rrule: 'FREQ=DAILY;UNTIL=20260612T000000Z',
    });
    const occ = expandOccurrences(e, winStart, winEnd);
    expect(occ).toHaveLength(2); // 10th, 11th (12th 08:00 is after UNTIL midnight)
  });

  it('drops EXDATE-excluded occurrences', () => {
    const e = evt({
      start: new Date('2026-06-10T08:00:00Z'),
      rrule: 'FREQ=DAILY;COUNT=4',
      exdates: [new Date('2026-06-11T08:00:00Z'), new Date('2026-06-13T08:00:00Z')],
    });
    const occ = expandOccurrences(e, winStart, winEnd).map((d) => d.toISOString());
    expect(occ).toEqual(['2026-06-10T08:00:00.000Z', '2026-06-12T08:00:00.000Z']);
  });

  it('fast-forwards an unbounded daily series that started years ago (>1000 days)', () => {
    // Started 2022; without fast-forward the scan would exhaust its iteration cap before 2026.
    const e = evt({ start: new Date('2022-01-01T08:00:00Z'), rrule: 'FREQ=DAILY' });
    const occ = expandOccurrences(
      e,
      new Date('2026-06-10T00:00:00Z'),
      new Date('2026-06-12T23:59:59Z'),
    );
    expect(occ.map((d) => d.toISOString())).toEqual([
      '2026-06-10T08:00:00.000Z',
      '2026-06-11T08:00:00.000Z',
      '2026-06-12T08:00:00.000Z',
    ]);
  });

  it('parses EXDATE (with TZID) from an ICS document', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:rec@x',
      'DTSTART:20260610T080000Z',
      'RRULE:FREQ=DAILY;COUNT=3',
      'EXDATE:20260611T080000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const [e] = parseICalendar(ics);
    expect(e!.exdates.map((d) => d.toISOString())).toEqual(['2026-06-11T08:00:00.000Z']);
  });
});
