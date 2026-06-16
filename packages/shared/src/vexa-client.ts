import { normalizeMeetUrl } from './meet-link';

/**
 * Typed client for the self-hosted Vexa meeting engine (REST). Field names follow Vexa's API
 * (snake_case on the wire); we expose camelCase. Verify exact shapes against the live Swagger at
 * `${baseUrl}/docs` — Vexa's API shifts between releases (pinned: 0.10.6.3.14).
 *
 * Auth: every call sends `X-API-Key`. The meeting handle is `(platform, native_meeting_id)`.
 */
export type VexaPlatform = 'google_meet' | 'teams' | 'zoom';

export interface VexaCreateBotInput {
  platform: VexaPlatform;
  /** Meet code like `abc-defg-hij` (NOT a URL). Use `meetUrlToNativeId()` to derive it. */
  nativeMeetingId: string;
  botName?: string;
  language?: string;
  task?: 'transcribe' | 'translate';
  recordingEnabled?: boolean;
  transcribeEnabled?: boolean;
}

export interface VexaMeeting {
  id: number;
  platform: string;
  nativeMeetingId: string;
  status: string;
  constructedMeetingUrl?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

export interface VexaSegment {
  text: string;
  speaker?: string | null;
  /** Relative seconds from meeting start (Vexa `start_time`/`end_time`). */
  startTime?: number | null;
  endTime?: number | null;
  /** Absolute wall-clock ISO timestamps (Vexa `absolute_start_time`/`absolute_end_time`). */
  absoluteStartTime?: string | null;
  absoluteEndTime?: string | null;
  language?: string | null;
}

export interface VexaTranscript extends VexaMeeting {
  segments: VexaSegment[];
}

export interface VexaClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Injectable for tests; defaults to global fetch. */
  fetch?: typeof fetch;
}

export class VexaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'VexaError';
  }
}

/** Derive Vexa's `native_meeting_id` (the bare Meet code) from a Meet URL or code. Null if not a Meet link. */
export function meetUrlToNativeId(meetUrlOrCode: string | null | undefined): string | null {
  return normalizeMeetUrl(meetUrlOrCode)?.code ?? null;
}

/**
 * Map Vexa transcript segments to our DB shape: speaker + millisecond offsets + text. Prefers the
 * relative `start_time`/`end_time` seconds; falls back to 0 when absent. (Absolute timestamps are kept
 * separately for correlation.)
 */
export function mapVexaSegments(
  segments: VexaSegment[],
): { speaker: string | null; startMs: number; endMs: number; text: string }[] {
  return segments.map((s) => ({
    speaker: s.speaker ?? null,
    startMs: Math.round((s.startTime ?? 0) * 1000),
    endMs: Math.round((s.endTime ?? s.startTime ?? 0) * 1000),
    text: s.text,
  }));
}

function toMeeting(raw: Record<string, unknown>): VexaMeeting {
  return {
    id: Number(raw.id),
    platform: String(raw.platform ?? ''),
    nativeMeetingId: String(raw.native_meeting_id ?? ''),
    status: String(raw.status ?? ''),
    constructedMeetingUrl: (raw.constructed_meeting_url as string | null) ?? null,
    startTime: (raw.start_time as string | null) ?? null,
    endTime: (raw.end_time as string | null) ?? null,
  };
}

function toSegment(raw: Record<string, unknown>): VexaSegment {
  return {
    text: String(raw.text ?? ''),
    speaker: (raw.speaker as string | null) ?? null,
    startTime: raw.start_time == null ? null : Number(raw.start_time),
    endTime: raw.end_time == null ? null : Number(raw.end_time),
    absoluteStartTime: (raw.absolute_start_time as string | null) ?? null,
    absoluteEndTime: (raw.absolute_end_time as string | null) ?? null,
    language: (raw.language as string | null) ?? null,
  };
}

export class VexaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: VexaClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; json: unknown }> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'X-API-Key': this.apiKey,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new VexaError(`Vexa ${method} ${path} failed: ${res.status}`, res.status, text);
    }
    return { status: res.status, json: text ? JSON.parse(text) : null };
  }

  /** Request a bot to join a meeting. POST /bots */
  async createBot(input: VexaCreateBotInput): Promise<VexaMeeting> {
    const body: Record<string, unknown> = {
      platform: input.platform,
      native_meeting_id: input.nativeMeetingId,
    };
    if (input.botName !== undefined) body.bot_name = input.botName;
    if (input.language !== undefined) body.language = input.language;
    if (input.task !== undefined) body.task = input.task;
    if (input.recordingEnabled !== undefined) body.recording_enabled = input.recordingEnabled;
    if (input.transcribeEnabled !== undefined) body.transcribe_enabled = input.transcribeEnabled;
    const { json } = await this.request('POST', '/bots', body);
    return toMeeting(json as Record<string, unknown>);
  }

  /** Get a meeting's transcript (works during and after the call). GET /transcripts/{platform}/{id} */
  async getTranscript(platform: VexaPlatform, nativeMeetingId: string): Promise<VexaTranscript> {
    const { json } = await this.request(
      'GET',
      `/transcripts/${platform}/${encodeURIComponent(nativeMeetingId)}`,
    );
    const raw = json as Record<string, unknown>;
    const segments = Array.isArray(raw.segments)
      ? (raw.segments as Record<string, unknown>[]).map(toSegment)
      : [];
    return { ...toMeeting(raw), segments };
  }

  /** Tell the bot to leave. DELETE /bots/{platform}/{id} */
  async stopBot(platform: VexaPlatform, nativeMeetingId: string): Promise<void> {
    await this.request('DELETE', `/bots/${platform}/${encodeURIComponent(nativeMeetingId)}`);
  }

  /** List currently-running bots. GET /bots/status */
  async listRunningBots(): Promise<unknown[]> {
    const { json } = await this.request('GET', '/bots/status');
    const raw = json as Record<string, unknown>;
    return Array.isArray(raw.running_bots) ? (raw.running_bots as unknown[]) : [];
  }
}
