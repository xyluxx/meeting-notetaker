import { describe, expect, it } from 'vitest';
import { VexaClient, VexaError, mapVexaSegments, meetUrlToNativeId } from './vexa-client';

describe('meetUrlToNativeId', () => {
  it('derives the bare Meet code from a URL', () => {
    expect(meetUrlToNativeId('https://meet.google.com/abc-defg-hij')).toBe('abc-defg-hij');
  });
  it('accepts a bare code', () => {
    expect(meetUrlToNativeId('abc-defg-hij')).toBe('abc-defg-hij');
  });
  it('returns null for non-Meet input', () => {
    expect(meetUrlToNativeId('https://zoom.us/j/1')).toBeNull();
    expect(meetUrlToNativeId(null)).toBeNull();
  });
});

describe('mapVexaSegments', () => {
  it('maps relative seconds to ms and preserves speaker/text', () => {
    expect(
      mapVexaSegments([
        { text: 'hi', speaker: 'Alex', startTime: 1.5, endTime: 2.25 },
        { text: 'yo', speaker: null, startTime: null, endTime: null },
      ]),
    ).toEqual([
      { speaker: 'Alex', startMs: 1500, endMs: 2250, text: 'hi' },
      { speaker: null, startMs: 0, endMs: 0, text: 'yo' },
    ]);
  });
});

/** Minimal fetch double that records the last call and returns a canned response. */
function fakeFetch(response: { status?: number; body?: unknown }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: (init ?? {}) as RequestInit });
    const status = response.status ?? 200;
    const text = response.body === undefined ? '' : JSON.stringify(response.body);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('VexaClient.createBot', () => {
  it('POSTs /bots with X-API-Key and snake_case body (only set fields)', async () => {
    const { impl, calls } = fakeFetch({
      status: 201,
      body: {
        id: 42,
        platform: 'google_meet',
        native_meeting_id: 'abc-defg-hij',
        status: 'requested',
      },
    });
    const client = new VexaClient({ baseUrl: 'http://vexa:8056/', apiKey: 'k', fetch: impl });
    const meeting = await client.createBot({
      platform: 'google_meet',
      nativeMeetingId: 'abc-defg-hij',
      botName: 'Alex NoteTaker',
      recordingEnabled: true,
      transcribeEnabled: true,
    });

    expect(calls[0]?.url).toBe('http://vexa:8056/bots');
    expect(calls[0]?.init.method).toBe('POST');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('k');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      platform: 'google_meet',
      native_meeting_id: 'abc-defg-hij',
      bot_name: 'Alex NoteTaker',
      recording_enabled: true,
      transcribe_enabled: true,
    });
    expect(meeting).toMatchObject({ id: 42, status: 'requested', nativeMeetingId: 'abc-defg-hij' });
  });
});

describe('VexaClient.getTranscript', () => {
  it('GETs the transcript path and maps segments', async () => {
    const { impl, calls } = fakeFetch({
      body: {
        id: 42,
        platform: 'google_meet',
        native_meeting_id: 'abc-defg-hij',
        status: 'completed',
        segments: [{ text: 'hello', speaker: 'Alex', start_time: 0, end_time: 1.2 }],
      },
    });
    const client = new VexaClient({ baseUrl: 'http://vexa:8056', apiKey: 'k', fetch: impl });
    const t = await client.getTranscript('google_meet', 'abc-defg-hij');

    expect(calls[0]?.url).toBe('http://vexa:8056/transcripts/google_meet/abc-defg-hij');
    expect(calls[0]?.init.method).toBe('GET');
    expect(t.status).toBe('completed');
    expect(mapVexaSegments(t.segments)).toEqual([
      { speaker: 'Alex', startMs: 0, endMs: 1200, text: 'hello' },
    ]);
  });
});

describe('VexaClient.stopBot', () => {
  it('DELETEs the bot path', async () => {
    const { impl, calls } = fakeFetch({ status: 202 });
    const client = new VexaClient({ baseUrl: 'http://vexa:8056', apiKey: 'k', fetch: impl });
    await client.stopBot('google_meet', 'abc-defg-hij');
    expect(calls[0]?.url).toBe('http://vexa:8056/bots/google_meet/abc-defg-hij');
    expect(calls[0]?.init.method).toBe('DELETE');
  });
});

describe('VexaClient error handling', () => {
  it('throws VexaError on non-2xx', async () => {
    const { impl } = fakeFetch({ status: 401, body: { detail: 'bad key' } });
    const client = new VexaClient({ baseUrl: 'http://vexa:8056', apiKey: 'bad', fetch: impl });
    await expect(client.listRunningBots()).rejects.toBeInstanceOf(VexaError);
  });
});
