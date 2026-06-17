import { describe, expect, it } from 'vitest';
import { buildNotifyPayload, retentionCutoff } from './maintenance.js';

describe('retentionCutoff', () => {
  const now = new Date('2026-06-16T00:00:00Z');

  it('returns null when retention is disabled', () => {
    expect(retentionCutoff(now, 0)).toBeNull();
    expect(retentionCutoff(now, -5)).toBeNull();
    expect(retentionCutoff(now, Number.NaN)).toBeNull();
  });

  it('returns now minus N days', () => {
    expect(retentionCutoff(now, 30)!.toISOString()).toBe('2026-05-17T00:00:00.000Z');
  });
});

describe('buildNotifyPayload', () => {
  it('shapes a compact completion payload', () => {
    const payload = buildNotifyPayload(
      {
        id: 'm1',
        title: 'Sync',
        status: 'complete',
        startAt: new Date('2026-06-16T09:00:00Z'),
      },
      'We decided X.',
      ['Do A', 'Do B'],
    );
    expect(payload).toEqual({
      meetingId: 'm1',
      title: 'Sync',
      status: 'complete',
      startAt: '2026-06-16T09:00:00.000Z',
      summary: 'We decided X.',
      actionItems: ['Do A', 'Do B'],
    });
  });

  it('tolerates null title/summary/start', () => {
    const payload = buildNotifyPayload(
      { id: 'm2', title: null, status: 'complete', startAt: null },
      null,
      [],
    );
    expect(payload.startAt).toBeNull();
    expect(payload.summary).toBeNull();
  });
});
