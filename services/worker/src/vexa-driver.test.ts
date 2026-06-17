import { describe, expect, it } from 'vitest';
import { planDispatch } from './vexa-driver.js';

describe('planDispatch', () => {
  it('maps a Google Meet meeting to a Vexa create-bot request', () => {
    expect(
      planDispatch(
        { meetUrl: 'https://meet.google.com/abc-defg-hij', source: 'manual' },
        { botName: 'Alex NoteTaker' },
      ),
    ).toEqual({
      platform: 'google_meet',
      nativeMeetingId: 'abc-defg-hij',
      botName: 'Alex NoteTaker',
      recordingEnabled: true,
      transcribeEnabled: true,
    });
  });

  it('includes language when provided', () => {
    const plan = planDispatch(
      { meetUrl: 'https://meet.google.com/abc-defg-hij', source: 'google' },
      { botName: 'Bot', language: 'en' },
    );
    expect(plan?.language).toBe('en');
  });

  it('returns null when there is no usable meet URL', () => {
    expect(planDispatch({ meetUrl: null, source: 'manual' }, { botName: 'Bot' })).toBeNull();
    expect(
      planDispatch({ meetUrl: 'https://zoom.us/j/123', source: 'manual' }, { botName: 'Bot' }),
    ).toBeNull();
  });
});
