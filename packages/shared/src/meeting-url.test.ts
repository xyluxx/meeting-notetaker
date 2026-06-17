import { describe, expect, it } from 'vitest';
import { parseMeetingUrl } from './meeting-url';

describe('parseMeetingUrl', () => {
  it('parses Google Meet', () => {
    expect(parseMeetingUrl('https://meet.google.com/abc-defg-hij')).toEqual({
      platform: 'google_meet',
      nativeMeetingId: 'abc-defg-hij',
      url: 'https://meet.google.com/abc-defg-hij',
    });
  });

  it('parses Teams personal (teams.live.com) with passcode', () => {
    expect(
      parseMeetingUrl('https://teams.live.com/meet/937517380519?p=4wwYDS2psfCl0GR08y'),
    ).toEqual({
      platform: 'teams',
      nativeMeetingId: '937517380519',
      passcode: '4wwYDS2psfCl0GR08y',
      teamsBaseHost: 'teams.live.com',
      url: 'https://teams.live.com/meet/937517380519?p=4wwYDS2psfCl0GR08y',
    });
  });

  it('parses Zoom with pwd', () => {
    const p = parseMeetingUrl('https://us05web.zoom.us/j/87654321098?pwd=Abc123');
    expect(p?.platform).toBe('zoom');
    expect(p?.nativeMeetingId).toBe('87654321098');
    expect(p?.passcode).toBe('Abc123');
  });

  it('returns null for non-meeting URLs', () => {
    expect(parseMeetingUrl('https://example.com')).toBeNull();
    expect(parseMeetingUrl('')).toBeNull();
    expect(parseMeetingUrl(null)).toBeNull();
  });
});
