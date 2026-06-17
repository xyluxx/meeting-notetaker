'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/status-badge';

const DONE = new Set([
  'complete',
  'skipped',
  'cancelled',
  'failed_join',
  'failed_recording',
  'failed_processing',
]);

/**
 * Live status badge: subscribes to the meeting's SSE stream and updates the badge in place. When the
 * status advances (e.g. to summarizing/complete) it refreshes the server component so the freshly
 * stored transcript/summary/action-items appear without a manual reload.
 */
export function LiveStatus({
  meetingId,
  initialStatus,
}: {
  meetingId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (DONE.has(initialStatus)) return; // no need to stream a finished meeting
    const es = new EventSource(`/api/v1/meetings/${meetingId}/stream`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { status?: string };
        if (data.status) {
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

  return <StatusBadge status={status} />;
}
