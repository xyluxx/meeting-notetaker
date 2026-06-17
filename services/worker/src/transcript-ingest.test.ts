import { describe, expect, it } from 'vitest';
import { buildTranscriptText } from './transcript-ingest.js';

describe('buildTranscriptText', () => {
  it('renders speaker-labelled lines', () => {
    expect(
      buildTranscriptText([
        { text: 'hello team', speaker: 'Alex' },
        { text: 'launching Tuesday', speaker: 'Sam' },
      ]),
    ).toBe('[Alex] hello team\n[Sam] launching Tuesday');
  });

  it('falls back to "Speaker" when diarization is missing', () => {
    expect(buildTranscriptText([{ text: 'hi', speaker: null }])).toBe('[Speaker] hi');
  });

  it('returns empty string for no segments', () => {
    expect(buildTranscriptText([])).toBe('');
  });
});
