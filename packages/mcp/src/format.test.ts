import { describe, expect, it } from 'vitest';
import {
  formatActionItems,
  formatMeetingLine,
  formatTranscript,
  msToClock,
  wrapUntrusted,
} from './format';
import type { ActionItemRow, MeetingRow, TranscriptRow, TranscriptSegmentRow } from './types';

describe('msToClock', () => {
  it('formats sub-hour and hour+ durations', () => {
    expect(msToClock(0)).toBe('0:00');
    expect(msToClock(5_000)).toBe('0:05');
    expect(msToClock(65_000)).toBe('1:05');
    expect(msToClock(3_661_000)).toBe('1:01:01');
  });

  it('clamps negatives to zero', () => {
    expect(msToClock(-500)).toBe('0:00');
  });
});

describe('wrapUntrusted', () => {
  it('fences content with begin/end markers', () => {
    const wrapped = wrapUntrusted('hello');
    expect(wrapped).toContain('BEGIN MEETING CONTENT');
    expect(wrapped).toContain('END MEETING CONTENT');
    expect(wrapped).toContain('hello');
  });
});

describe('formatMeetingLine', () => {
  it('renders id, title, status, and time', () => {
    const m = {
      id: 'm1',
      title: 'Standup',
      status: 'complete',
      startAt: new Date('2026-06-16T09:00:00Z'),
    } as MeetingRow;
    const line = formatMeetingLine(m);
    expect(line).toContain('m1');
    expect(line).toContain('Standup');
    expect(line).toContain('status=complete');
    expect(line).toContain('2026-06-16T09:00:00.000Z');
  });

  it('handles untitled and unscheduled meetings', () => {
    const m = { id: 'm2', title: null, status: 'scheduled', startAt: null } as MeetingRow;
    const line = formatMeetingLine(m);
    expect(line).toContain('(untitled)');
    expect(line).toContain('unscheduled');
  });
});

describe('formatTranscript', () => {
  it('renders timestamped, speaker-labelled, fenced segments', () => {
    const transcript = {
      engine: 'vexa',
      model: 'tiny',
      language: 'en',
    } as TranscriptRow;
    const segments = [
      { startMs: 0, speaker: 'Alice', text: 'Hi there' },
      { startMs: 65_000, speaker: null, text: 'No speaker' },
    ] as TranscriptSegmentRow[];
    const out = formatTranscript(transcript, segments);
    expect(out).toContain('engine=vexa');
    expect(out).toContain('[0:00] Alice: Hi there');
    expect(out).toContain('[1:05] No speaker');
    expect(out).toContain('BEGIN MEETING CONTENT');
  });

  it('falls back to fullText when there are no segments', () => {
    const transcript = {
      engine: 'vexa',
      model: null,
      language: null,
      fullText: 'whole thing',
    } as TranscriptRow;
    const out = formatTranscript(transcript, []);
    expect(out).toContain('whole thing');
  });
});

describe('formatActionItems', () => {
  it('renders checkboxes and reports empty', () => {
    expect(formatActionItems([])).toBe('No action items.');
    const items = [
      { id: 'a1', text: 'Do thing', done: false, assignee: 'bob', dueAt: null },
      { id: 'a2', text: 'Done thing', done: true, assignee: null, dueAt: null },
    ] as ActionItemRow[];
    const out = formatActionItems(items);
    expect(out).toContain('[ ] a1 · Do thing (@bob)');
    expect(out).toContain('[x] a2 · Done thing');
  });
});
