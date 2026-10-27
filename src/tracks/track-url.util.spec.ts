import { parseTrackUrl } from './track-url.util';

describe('music URL parsing', () => {
  it.each([
    ['https://open.spotify.com/intl-ko/track/abc123?si=ignored', 'spotify', 'abc123'],
    ['https://music.youtube.com/watch?v=abc123', 'youtube-music', 'abc123'],
    ['https://m.youtube.com/watch?v=abc123', 'youtube', 'abc123'],
    ['https://youtu.be/abc123', 'youtube', 'abc123'],
    ['https://music.apple.com/kr/album/name/123?i=456', 'apple-music', '456'],
    ['https://music.apple.com/kr/song/name/456', 'apple-music', '456'],
    ['https://www.music-flo.com/detail/track/123/details', 'flo', '123'],
    ['https://www.genie.co.kr/detail/songInfo?xgnm=123', 'genie', '123'],
    ['https://m2.melon.com/song/detail.htm?songId=123', 'melon', '123'],
  ])('parses %s', (url, platformSlug, externalId) => {
    expect(parseTrackUrl(url)).toEqual({ platformSlug, externalId });
  });
  it.each([
    'not a URL',
    'https://evil-melon.com/?songId=1',
    'https://open.spotify.com.evil.test/track/a',
    'https://user@open.spotify.com/track/a',
    'ftp://open.spotify.com/track/a',
    'https://open.spotify.com:8443/track/a',
  ])('rejects %s', (url) => {
    expect(() => parseTrackUrl(url)).toThrow();
  });
});
