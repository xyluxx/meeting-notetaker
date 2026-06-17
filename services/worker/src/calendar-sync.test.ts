import type { AutoJoinRules, VEvent } from '@pmn/shared';
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
