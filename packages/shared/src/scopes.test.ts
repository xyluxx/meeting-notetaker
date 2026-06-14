import { describe, expect, it } from 'vitest';
import { hasAllScopes, hasScope, isApiScope } from './scopes.js';

describe('scopes', () => {
  it('recognizes valid scopes', () => {
    expect(isApiScope('meetings:read')).toBe(true);
    expect(isApiScope('nonsense:read')).toBe(false);
  });

  it('grants exact scopes', () => {
    expect(hasScope(['meetings:read'], 'meetings:read')).toBe(true);
    expect(hasScope(['transcripts:read'], 'meetings:read')).toBe(false);
  });

  it('write scope implies read scope', () => {
    expect(hasScope(['action_items:write'], 'action_items:read')).toBe(true);
    expect(hasScope(['action_items:read'], 'action_items:write')).toBe(false);
  });

  it('checks all required scopes', () => {
    expect(
      hasAllScopes(['meetings:read', 'transcripts:read'], ['meetings:read', 'transcripts:read']),
    ).toBe(true);
    expect(hasAllScopes(['meetings:read'], ['meetings:read', 'recordings:read'])).toBe(false);
  });
});
