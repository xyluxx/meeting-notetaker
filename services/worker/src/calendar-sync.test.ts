import { type AutoJoinRules, type VEvent, parseICalendar } from '@pmn/shared';
import { describe, expect, it } from 'vitest';
import { planMeetingsFromEvents } from './calendar-sync.js';

const WIN_START = new Date('2026-06-01T00:00:00Z');
const WIN_END = new Date('2026-06-30T23:59:59Z');

function evt(over: Partial<VEvent>): VEvent {
  return {
    uid: 'u1',
    summary: 'Sync',
    description: 'https://meet.google.com/abc-defg-hij',
    location: null,
    url: null,
    start: new Date('2026-06-10T09:00:00Z'),
    end: new Date('2026-06-10T09:30:00Z'),
    allDay: false,
    status: null,
    organizerEmail: 'me@acme.com',
    attendeeEmails: ['ext@other.com'],
    rrule: null,
    exdates: [],
    recurrenceId: null,
    sequence: 0,
    ...over,
  };
}

const RULES_ON: AutoJoinRules = { globalEnabled: true };
const RULES_OFF: AutoJoinRules = { globalEnabled: false };

describe('planMeetingsFromEvents', () => {
  it('plans a single meeting with parsed URL and duration-derived end', () => {
    const [m] = planMeetingsFromEvents([evt({})], WIN_START, WIN_END, RULES_ON, null);
    expect(m!.meetUrl).toContain('meet.google.com/abc-defg-hij');
    expect(m!.externalEventId).toBe('u1');
    expect(m!.startAt.toISOString()).toBe('2026-06-10T09:00:00.000Z');
    expect(m!.endAt?.toISOString()).toBe('2026-06-10T09:30:00.000Z');
    expect(m!.autoJoin).toBe(true);
  });

  it('drops events without a recognized meeting URL', () => {
    const plan = planMeetingsFromEvents(
      [evt({ description: 'no link here', location: null, url: null })],
      WIN_START,
      WIN_END,
      RULES_ON,
      null,
    );
    expect(plan).toHaveLength(0);
  });

  it('skips CANCELLED events', () => {
    expect(
      planMeetingsFromEvents([evt({ status: 'CANCELLED' })], WIN_START, WIN_END, RULES_ON, null),
    ).toHaveLength(0);
  });

  it('fans recurring events out to one meeting per occurrence with unique ids', () => {
    const plan = planMeetingsFromEvents(
      [evt({ start: new Date('2026-06-01T09:00:00Z'), rrule: 'FREQ=DAILY;COUNT=3' })],
      WIN_START,
      WIN_END,
      RULES_ON,
      null,
    );
    expect(plan).toHaveLength(3);
    expect(new Set(plan.map((p) => p.externalEventId)).size).toBe(3);
    expect(plan[0]!.externalEventId).toContain('::2026-06-01');
  });

  it('respects auto-join rules (global off → not joined, but still planned)', () => {
    const [m] = planMeetingsFromEvents([evt({})], WIN_START, WIN_END, RULES_OFF, null);
    expect(m!.autoJoin).toBe(false);
    expect(m!.autoJoinReason).toContain('off');
  });

  it('honors the per-calendar default over the global switch', () => {
    const [m] = planMeetingsFromEvents([evt({})], WIN_START, WIN_END, RULES_OFF, true);
    expect(m!.autoJoin).toBe(true);
  });

  it('applies deny-domain rules', () => {
    const rules: AutoJoinRules = { globalEnabled: true, denyDomains: ['other.com'] };
    const [m] = planMeetingsFromEvents([evt({})], WIN_START, WIN_END, rules, null);
    expect(m!.autoJoin).toBe(false);
    expect(m!.autoJoinReason).toContain('deny');
  });
});

describe('planMeetingsFromEvents — RFC 5545 exceptions (EXDATE + RECURRENCE-ID)', () => {
  const LINK = 'https://meet.google.com/abc-defg-hij';
  // Daily standup, 5 occurrences (10th–14th @09:00Z). One day excluded (EXDATE 12th),
  // one day moved (RECURRENCE-ID 13th → 14:00Z). Expect exactly 4 meetings, joined once each.
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:standup@x',
    'SUMMARY:Daily standup',
    `DESCRIPTION:${LINK}`,
    'DTSTART:20260610T090000Z',
    'DTEND:20260610T091500Z',
    'RRULE:FREQ=DAILY;COUNT=5',
    'EXDATE:20260612T090000Z',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:standup@x',
    'SUMMARY:Daily standup (moved)',
    `DESCRIPTION:${LINK}`,
    'RECURRENCE-ID:20260613T090000Z',
    'DTSTART:20260613T140000Z',
    'DTEND:20260613T141500Z',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  it('excludes EXDATE days, moves overridden occurrences, and never duplicates', () => {
    const events = parseICalendar(ics);
    const plan = planMeetingsFromEvents(events, WIN_START, WIN_END, RULES_ON, null);

    // 5 occurrences − 1 excluded = 4 slots, no duplicates.
    expect(plan).toHaveLength(4);
    expect(new Set(plan.map((p) => p.externalEventId)).size).toBe(4);

    const starts = plan.map((p) => p.startAt.toISOString()).sort();
    // 12th is gone; 13th is moved from 09:00 to 14:00.
    expect(starts).toEqual([
      '2026-06-10T09:00:00.000Z',
      '2026-06-11T09:00:00.000Z',
      '2026-06-13T14:00:00.000Z',
      '2026-06-14T09:00:00.000Z',
    ]);
    expect(plan.some((p) => p.startAt.toISOString() === '2026-06-12T09:00:00.000Z')).toBe(false);

    // The moved occurrence keeps the original-slot id so the DB upsert updates (not duplicates).
    const moved = plan.find((p) => p.startAt.toISOString() === '2026-06-13T14:00:00.000Z');
    expect(moved!.externalEventId).toBe('standup@x::2026-06-13T09:00:00.000Z');
    expect(moved!.title).toBe('Daily standup (moved)');
  });

  it('removes an occurrence cancelled via a RECURRENCE-ID override', () => {
    const cancelIcs = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:s2@x',
      `DESCRIPTION:${LINK}`,
      'DTSTART:20260610T090000Z',
      'RRULE:FREQ=DAILY;COUNT=3',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:s2@x',
      'RECURRENCE-ID:20260611T090000Z',
      'DTSTART:20260611T090000Z',
      'STATUS:CANCELLED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const plan = planMeetingsFromEvents(
      parseICalendar(cancelIcs),
      WIN_START,
      WIN_END,
      RULES_ON,
      null,
    );
    expect(plan.map((p) => p.startAt.toISOString()).sort()).toEqual([
      '2026-06-10T09:00:00.000Z',
      '2026-06-12T09:00:00.000Z',
    ]);
  });
});
