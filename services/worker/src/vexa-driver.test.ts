import { describe, expect, it } from 'vitest';
import { mapVexaStatus, planDispatch } from './vexa-driver.js';

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

  it('maps Teams links with passcode', () => {
    const plan = planDispatch(
      { meetUrl: 'https://teams.live.com/meet/937517380519?p=abc', source: 'manual' },
      { botName: 'Bot' },
    );
    expect(plan?.platform).toBe('teams');
    expect(plan?.nativeMeetingId).toBe('937517380519');
    expect(plan?.passcode).toBe('abc');
    expect(plan?.teamsBaseHost).toBe('teams.live.com');
  });
});

describe('mapVexaStatus', () => {
  it('maps the Vexa lifecycle to our statuses', () => {
    expect(mapVexaStatus('joining')?.status).toBe('joining');
    expect(mapVexaStatus('awaiting_admission')?.status).toBe('waiting_lobby');
    expect(mapVexaStatus('active')?.status).toBe('recording');
    expect(mapVexaStatus('completed')).toEqual({
      status: 'processing',
      terminal: true,
      completed: true,
    });
    expect(mapVexaStatus('failed')).toEqual({
      status: 'failed_recording',
      terminal: true,
      completed: false,
    });
    expect(mapVexaStatus('weird-unknown')).toBeNull();
  });
});
