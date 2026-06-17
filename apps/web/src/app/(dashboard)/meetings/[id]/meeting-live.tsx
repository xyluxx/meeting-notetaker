'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { StatusBadge } from '@/components/status-badge';

const DONE = new Set([
  'complete',
  'skipped',
  'cancelled',
  'failed_join',
  'failed_recording',
  'failed_processing',
]);

interface LiveSegment {
  startMs: number;
  speaker: string | null;
  text: string;
}

interface LiveState {
  status: string;
  liveSegments: LiveSegment[] | null;
}

const LiveCtx = createContext<LiveState>({ status: '', liveSegments: null });

/**
 * Owns a single EventSource to the meeting's SSE stream and shares live state via context, so the
 * header badge and the transcript pane update from one connection. On a status change it also
 * refreshes the server component so freshly stored transcript/summary/action-items appear; on a
 * `transcript` event it updates the in-progress live segments.
 */
export function MeetingLiveProvider({
  meetingId,
  initialStatus,
  children,
}: {
  meetingId: string;
  initialStatus: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [liveSegments, setLiveSegments] = useState<LiveSegment[] | null>(null);

  useEffect(() => {
    if (DONE.has(initialStatus)) return; // a finished meeting has nothing to stream
    const es = new EventSource(`/api/v1/meetings/${meetingId}/stream`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as {
          status?: string;
          type?: string;
          segments?: LiveSegment[];
        };
        if (data.type === 'transcript' && Array.isArray(data.segments)) {
          setLiveSegments(data.segments);
        } else if (data.status) {
          setStatus(data.status);
          router.refresh();
          if (DONE.has(data.status)) es.close();
        }
      } catch {
        /* ignore non-JSON keepalives */
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [meetingId, initialStatus, router]);

  return <LiveCtx.Provider value={{ status, liveSegments }}>{children}</LiveCtx.Provider>;
}

function useLive(): LiveState {
  return useContext(LiveCtx);
}

/** Status badge wired to the live stream. */
export function LiveStatusBadge() {
  const { status } = useLive();
  return <StatusBadge status={status} />;
}

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Transcript pane. While the meeting is live it shows the streaming segments (or a "listening"
 * placeholder until the first words arrive); once the meeting is finished it renders `fallback`
 * (the server-rendered final transcript, which is authoritative).
 */
export function LiveTranscriptPane({ fallback }: { fallback: React.ReactNode }) {
  const { status, liveSegments } = useLive();
  const isLive = !DONE.has(status);

  if (!isLive) return <>{fallback}</>;

  if (liveSegments && liveSegments.length > 0) {
    return (
      <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
        <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
          <span className="rec-dot h-1.5 w-1.5 rounded-full" aria-hidden />
          Live — transcribing as the meeting runs
        </div>
        {liveSegments.map((seg, i) => (
          <p key={i} className="flex gap-3">
            <span className="w-12 shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
              {clock(seg.startMs)}
            </span>
            <span>
              {seg.speaker && <span className="font-medium">{seg.speaker}: </span>}
              {seg.text}
            </span>
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--border)] p-6 text-sm text-[var(--muted-foreground)]">
      <span className="rec-dot h-1.5 w-1.5 rounded-full" aria-hidden />
      Listening… the live transcript will appear here as people speak (updates every ~15s).
    </div>
  );
}
