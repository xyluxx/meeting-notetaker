import { describe, expect, it } from 'vitest';
import { OpenRouterClient, summarizeTranscript } from './openrouter';

/** Fake fetch returning a sequence of canned chat-completion contents. */
function fakeOpenRouter(contents: string[]) {
  const calls: { body: unknown }[] = [];
  let i = 0;
  const impl = (async (_url: unknown, init: unknown) => {
    const body = JSON.parse(String((init as RequestInit).body));
    calls.push({ body });
    const content = contents[Math.min(i++, contents.length - 1)];
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
    } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('summarizeTranscript', () => {
  it('parses a valid JSON summary + action items', async () => {
    const { impl, calls } = fakeOpenRouter([
      JSON.stringify({
        summary: 'We agreed to launch the beta Tuesday.',
        key_decisions: [{ text: 'Launch beta Tuesday' }],
        action_items: [
          { text: 'Email customers', owner: 'Sam', due: 'tomorrow' },
          { text: 'Finish settings page', owner: null, due: null },
        ],
      }),
    ]);
    const client = new OpenRouterClient({ apiKey: 'k', fetch: impl });
    const res = await summarizeTranscript(client, {
      transcript: '[Alex] launch beta Tuesday\n[Sam] I will email customers',
      model: 'anthropic/claude-haiku-4-5',
    });

    expect(res.ok).toBe(true);
    expect(res.summary).toContain('beta');
    expect(res.keyDecisions).toEqual([{ text: 'Launch beta Tuesday' }]);
    expect(res.actionItems).toEqual([
      { text: 'Email customers', owner: 'Sam', due: 'tomorrow' },
      { text: 'Finish settings page', owner: null, due: null },
    ]);
    // transcript goes in the user message, never the system prompt
    const msgs = (calls[0]?.body as { messages: { role: string; content: string }[] }).messages;
    expect(msgs[0]?.role).toBe('system');
    expect(msgs[0]?.content.includes('I will email customers')).toBe(false);
    expect(msgs[1]?.role).toBe('user');
    expect(msgs[1]?.content).toContain('I will email customers');
  });

  it('strips markdown fences', async () => {
    const { impl } = fakeOpenRouter([
      '```json\n{"summary":"ok","key_decisions":[],"action_items":[]}\n```',
    ]);
    const client = new OpenRouterClient({ apiKey: 'k', fetch: impl });
    const res = await summarizeTranscript(client, { transcript: 't', model: 'm' });
    expect(res.ok).toBe(true);
    expect(res.summary).toBe('ok');
  });

  it('repairs once when the first response is invalid JSON', async () => {
    const { impl, calls } = fakeOpenRouter([
      'sorry, here is your summary: not json',
      JSON.stringify({ summary: 'fixed', key_decisions: [], action_items: [] }),
    ]);
    const client = new OpenRouterClient({ apiKey: 'k', fetch: impl });
    const res = await summarizeTranscript(client, { transcript: 't', model: 'm' });
    expect(calls.length).toBe(2); // original + repair
    expect(res.ok).toBe(true);
    expect(res.summary).toBe('fixed');
  });

  it('returns a graceful ok:false result when even the repair fails', async () => {
    const { impl } = fakeOpenRouter(['nope', 'still nope']);
    const client = new OpenRouterClient({ apiKey: 'k', fetch: impl });
    const res = await summarizeTranscript(client, { transcript: 't', model: 'm' });
    expect(res.ok).toBe(false);
    expect(res.actionItems).toEqual([]);
    expect(res.summary).toMatch(/could not be generated/i);
  });
});
