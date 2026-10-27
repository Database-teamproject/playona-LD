import { TrackMetadata } from './providers/track-metadata';
import {
  artistNames,
  hasMatchingArtist,
  isEvidenceMatch,
  isSimilar,
  names,
} from './track-match-verifier';

const source: TrackMetadata = {
  platformSlug: 'spotify',
  externalId: '1',
  url: 'https://open.spotify.com/track/1',
  title: 'Morning',
  artist: 'Original Artist',
  isrc: null,
  album: null,
  durationMs: 180000,
  releaseDate: '2026-01-01',
  thumbnailUrl: null,
};

describe('matching regression cases from Spring dev', () => {
  it.each([
    'Morning (Live)',
    'Morning (Remix)',
    'Morning Acoustic',
    'Morning (English Version)',
    'Evening',
  ])('rejects a different recording: %s', (title) => {
    expect(isEvidenceMatch(source, { ...source, title })).toBe(false);
  });
  it('requires independent metadata for translated titles', () => {
    const translated = { ...source, title: '아침' };
    expect(isEvidenceMatch(source, translated)).toBe(true);
    expect(isEvidenceMatch(source, { ...translated, durationMs: null })).toBe(false);
    expect(isEvidenceMatch(source, { ...translated, releaseDate: null })).toBe(false);
    expect(isEvidenceMatch(source, { ...translated, durationMs: 190000 })).toBe(false);
  });
  it('rejects conflicting ISRCs even when titles match', () => {
    expect(isEvidenceMatch({ ...source, isrc: 'ONE' }, { ...source, isrc: 'TWO' })).toBe(false);
  });
  it('accepts explicit bilingual aliases without discarding recording versions', () => {
    expect(isSimilar('アイドル (Idol)', 'Idol')).toBe(true);
    expect(isSimilar('アイドル (Live)', 'アイドル')).toBe(false);
    expect(names('Finale. * 영화 [작품] 주제가')).toEqual(['Finale.']);
    expect(isSimilar('Finale.', 'Finale. * unrelated subtitle')).toBe(false);
  });
  it('matches bilingual main artists but does not select a secondary artist', () => {
    expect(artistNames('米津玄師 Kenshi Yonezu')).toEqual(['米津玄師', 'Kenshi Yonezu']);
    expect(hasMatchingArtist('米津玄師 Kenshi Yonezu', 'Kenshi Yonezu')).toBe(true);
    expect(hasMatchingArtist('Original Artist & Other Artist', 'Other Artist')).toBe(false);
  });
  it('accepts close durations and rejects missing evidence for an artist mismatch', () => {
    expect(isEvidenceMatch(source, { ...source, durationMs: 181000 })).toBe(true);
    expect(isEvidenceMatch(source, { ...source, durationMs: 220000 })).toBe(false);
    expect(isEvidenceMatch(source, { ...source, artist: 'Other Artist', durationMs: null })).toBe(
      false,
    );
  });
});
