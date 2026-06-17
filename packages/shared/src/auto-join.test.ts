import { describe, expect, it } from 'vitest';
import { type AutoJoinRules, evaluateAutoJoin } from './auto-join';

const base: AutoJoinRules = { globalEnabled: true };

describe('evaluateAutoJoin', () => {
  it('never joins without a meet URL', () => {
    expect(evaluateAutoJoin(base, { hasMeetUrl: false }).join).toBe(false);
  });

  it('per-meeting override wins both ways', () => {
    expect(
      evaluateAutoJoin({ globalEnabled: false }, { hasMeetUrl: true, perMeetingOverride: true })
        .join,
    ).toBe(true);
    expect(
      evaluateAutoJoin({ globalEnabled: true }, { hasMeetUrl: true, perMeetingOverride: false })
        .join,
    ).toBe(false);
  });

  it('respects the global switch when nothing else applies', () => {
    expect(evaluateAutoJoin({ globalEnabled: true }, { hasMeetUrl: true }).join).toBe(true);
    expect(evaluateAutoJoin({ globalEnabled: false }, { hasMeetUrl: true }).join).toBe(false);
  });

  it('per-calendar default overrides the global switch', () => {
    expect(
      evaluateAutoJoin({ globalEnabled: false }, { hasMeetUrl: true, calendarDefault: true }).join,
    ).toBe(true);
    expect(
      evaluateAutoJoin({ globalEnabled: true }, { hasMeetUrl: true, calendarDefault: false }).join,
    ).toBe(false);
  });

  it('skips on a title keyword', () => {
    const d = evaluateAutoJoin(
      { globalEnabled: true, skipTitleKeywords: ['1:1', 'personal'] },
      { hasMeetUrl: true, title: 'Weekly 1:1 with Sam' },
    );
    expect(d.join).toBe(false);
    expect(d.reason).toContain('1:1');
  });

  it('deny domain skips even with global on', () => {
    expect(
      evaluateAutoJoin(
        { globalEnabled: true, denyDomains: ['acme.com'] },
        { hasMeetUrl: true, organizerEmail: 'ceo@acme.com' },
      ).join,
    ).toBe(false);
  });

  it('allow-list requires a match', () => {
    const rules: AutoJoinRules = { globalEnabled: true, allowDomains: ['mycorp.com'] };
    expect(
      evaluateAutoJoin(rules, { hasMeetUrl: true, attendeeEmails: ['a@other.com'] }).join,
    ).toBe(false);
    expect(
      evaluateAutoJoin(rules, { hasMeetUrl: true, attendeeEmails: ['a@mycorp.com'] }).join,
    ).toBe(true);
  });
});
