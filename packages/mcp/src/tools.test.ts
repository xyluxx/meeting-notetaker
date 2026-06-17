import { describe, expect, it, vi } from 'vitest';
import { type ToolContext, allToolNames, callTool, listTools } from './tools';
import type { ActionItemRow, MeetingQueries, MeetingRow } from './types';

function fakeQueries(over: Partial<MeetingQueries> = {}): MeetingQueries {
  return {
    searchMeetings: vi.fn(async () => []),
    getMeeting: vi.fn(async () => null),
    getTranscript: vi.fn(async () => null),
    getSummary: vi.fn(async () => null),
    listActionItems: vi.fn(async () => []),
    updateActionItem: vi.fn(async () => true),
    ...over,
  };
}

function ctx(scopes: string[], queries = fakeQueries()): ToolContext {
  return { queries, userId: 'user-1', scopes };
}

const ALL_SCOPES = [
  'meetings:read',
  'transcripts:read',
  'summaries:read',
  'action_items:read',
  'action_items:write',
];

describe('listTools (scope gating)', () => {
  it('exposes only tools the scopes allow', () => {
    const names = listTools(['meetings:read']).map((t) => t.name);
    expect(names).toEqual(['search_meetings', 'get_meeting']);
  });

  it('exposes write tool only with action_items:write', () => {
    expect(listTools(['action_items:read']).map((t) => t.name)).toEqual(['list_action_items']);
    const rw = listTools(['action_items:write']).map((t) => t.name);
    expect(rw).toContain('list_action_items'); // write implies read
    expect(rw).toContain('update_action_item');
  });

  it('exposes every tool with the full scope set', () => {
    expect(
      listTools(ALL_SCOPES)
        .map((t) => t.name)
        .sort(),
    ).toEqual(allToolNames().sort());
  });

  it('emits valid object input schemas without a $schema key', () => {
    for (const t of listTools(ALL_SCOPES)) {
      expect(t.inputSchema.type).toBe('object');
      expect(t.inputSchema).not.toHaveProperty('$schema');
    }
  });
});

describe('callTool', () => {
  it('rejects an unknown tool', async () => {
    const res = await callTool(ctx(ALL_SCOPES), 'nope', {});
    expect(res.isError).toBe(true);
    expect(res.text).toContain('Unknown tool');
  });

  it('rejects a tool the key is not scoped for', async () => {
    const res = await callTool(ctx(['meetings:read']), 'get_transcript', { meeting_id: 'm1' });
    expect(res.isError).toBe(true);
    expect(res.text).toContain('transcripts:read');
  });

  it('rejects invalid arguments', async () => {
    const res = await callTool(ctx(['meetings:read']), 'get_meeting', {});
    expect(res.isError).toBe(true);
    expect(res.text).toContain('Invalid arguments');
  });

  it('runs search_meetings and formats results', async () => {
    const queries = fakeQueries({
      searchMeetings: vi.fn(async () => [
        { id: 'm1', title: 'Sync', status: 'complete', startAt: null } as MeetingRow,
      ]),
    });
    const res = await callTool(ctx(['meetings:read'], queries), 'search_meetings', {
      query: 'sync',
    });
    expect(res.isError).toBe(false);
    expect(res.text).toContain('m1');
    expect(queries.searchMeetings).toHaveBeenCalledWith('user-1', {
      query: 'sync',
      status: undefined,
      limit: 25,
    });
  });

  it('updates an action item with write scope', async () => {
    const queries = fakeQueries({ updateActionItem: vi.fn(async () => true) });
    const res = await callTool(ctx(['action_items:write'], queries), 'update_action_item', {
      action_item_id: 'a1',
      done: true,
    });
    expect(res.isError).toBe(false);
    expect(res.text).toContain('marked done');
    expect(queries.updateActionItem).toHaveBeenCalledWith('user-1', 'a1', true);
  });

  it('reports a missing action item as an error', async () => {
    const queries = fakeQueries({ updateActionItem: vi.fn(async () => false) });
    const res = await callTool(ctx(['action_items:write'], queries), 'update_action_item', {
      action_item_id: 'missing',
      done: false,
    });
    expect(res.isError).toBe(true);
    expect(res.text).toContain('not found');
  });

  it('lists action items via the read scope', async () => {
    const queries = fakeQueries({
      listActionItems: vi.fn(async () => [
        { id: 'a1', text: 'task', done: false, assignee: null, dueAt: null } as ActionItemRow,
      ]),
    });
    const res = await callTool(ctx(['action_items:read'], queries), 'list_action_items', {});
    expect(res.isError).toBe(false);
    expect(res.text).toContain('a1');
  });
});
