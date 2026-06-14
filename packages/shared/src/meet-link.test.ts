import { describe, expect, it } from 'vitest';
import { extractMeetLink, isHangoutsMeet, normalizeMeetUrl } from './meet-link.js';

describe('normalizeMeetUrl', () => {
  it('parses a full Meet URL', () => {
    expect(normalizeMeetUrl('https://meet.google.com/abc-defg-hij')).toEqual({
      url: 'https://meet.google.com/abc-defg-hij',
      code: 'abc-defg-hij',
    });
  });

  it('lowercases and strips surrounding text', () => {
    expect(normalizeMeetUrl('Join here: HTTPS://MEET.GOOGLE.COM/ABC-DEFG-HIJ now')).toEqual({
      url: 'https://meet.google.com/abc-defg-hij',
      code: 'abc-defg-hij',
    });
  });

  it('parses a bare meeting code', () => {
    expect(normalizeMeetUrl('code abc-defg-hij please')).toEqual({
      url: 'https://meet.google.com/abc-defg-hij',
      code: 'abc-defg-hij',
    });
  });

  it('returns null for non-Meet content', () => {
    expect(normalizeMeetUrl('https://zoom.us/j/123456')).toBeNull();
    expect(normalizeMeetUrl('no link here')).toBeNull();
    expect(normalizeMeetUrl(null)).toBeNull();
    expect(normalizeMeetUrl(undefined)).toBeNull();
  });

  it('does not match malformed codes', () => {
    expect(normalizeMeetUrl('abcd-efg-hij')).toBeNull();
    expect(normalizeMeetUrl('ab-defg-hij')).toBeNull();
  });
});

describe('extractMeetLink', () => {
  it('prefers conferenceData video entry point', () => {
    const result = extractMeetLink({
      hangoutLink: 'https://meet.google.com/zzz-zzzz-zzz',
      conferenceData: {
        conferenceSolution: { key: { type: 'hangoutsMeet' } },
        entryPoints: [
          { entryPointType: 'phone', uri: 'tel:+1-555' },
          { entryPointType: 'video', uri: 'https://meet.google.com/abc-defg-hij' },
        ],
      },
    });
    expect(result).toEqual({
      url: 'https://meet.google.com/abc-defg-hij',
      code: 'abc-defg-hij',
      source: 'conferenceData',
    });
  });

  it('falls back to hangoutLink', () => {
    const result = extractMeetLink({ hangoutLink: 'https://meet.google.com/abc-defg-hij' });
    expect(result?.source).toBe('hangoutLink');
    expect(result?.code).toBe('abc-defg-hij');
  });

  it('falls back to regex over location then description', () => {
    expect(
      extractMeetLink({ location: 'Room 4 — https://meet.google.com/abc-defg-hij' })?.source,
    ).toBe('regex');
    expect(
      extractMeetLink({ description: 'agenda...\nhttps://meet.google.com/abc-defg-hij' })?.source,
    ).toBe('regex');
  });

  it('returns null when there is no Meet link', () => {
    expect(extractMeetLink({ description: 'no conferencing' })).toBeNull();
    expect(extractMeetLink({})).toBeNull();
  });

  it('detects hangoutsMeet conference solution', () => {
    expect(
      isHangoutsMeet({ conferenceData: { conferenceSolution: { key: { type: 'hangoutsMeet' } } } }),
    ).toBe(true);
    expect(
      isHangoutsMeet({ conferenceData: { conferenceSolution: { key: { type: 'addOn' } } } }),
    ).toBe(false);
    expect(isHangoutsMeet({})).toBe(false);
  });
});
