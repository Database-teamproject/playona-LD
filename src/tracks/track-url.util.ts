import { BadRequestException } from '@nestjs/common';

export interface ParsedTrackUrl {
  /** 플랫폼 slug (DB platforms.slug 와 일치) */
  platformSlug: string;
  /** 플랫폼 내 곡 식별자 */
  externalId: string;
}

/**
 * 플랫폼 음악 URL → { platformSlug, externalId } 파싱
 * 지원하지 않는 형식이면 400 을 던짐
 */
export function parseTrackUrl(rawUrl: string): ParsedTrackUrl {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new BadRequestException('유효한 URL 형식이 아닙니다');
  }

  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) {
    throw new BadRequestException('지원하지 않는 URL 형식입니다');
  }

  const host = url.hostname.replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);

  // Spotify: https://open.spotify.com/track/{id}
  const trackIndex = segments[0]?.startsWith('intl-') ? 1 : 0;
  if (
    host === 'open.spotify.com' &&
    segments[trackIndex] === 'track' &&
    /^[A-Za-z0-9]+$/.test(segments[trackIndex + 1] ?? '')
  ) {
    return { platformSlug: 'spotify', externalId: segments[trackIndex + 1] };
  }

  // YouTube Music: https://music.youtube.com/watch?v={id}
  if (host === 'music.youtube.com') {
    const v = url.searchParams.get('v');
    if (v) return { platformSlug: 'youtube-music', externalId: v };
  }

  // YouTube: https://youtube.com/watch?v={id} | https://youtu.be/{id}
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const v = url.searchParams.get('v');
    if (v) return { platformSlug: 'youtube', externalId: v };
    if (['shorts', 'embed'].includes(segments[0]) && segments[1])
      return { platformSlug: 'youtube', externalId: segments[1] };
  }
  if (host === 'youtu.be' && segments[0]) {
    return { platformSlug: 'youtube', externalId: segments[0] };
  }

  // Apple Music: https://music.apple.com/{country}/album/{name}/{albumId}?i={trackId}
  if (host === 'music.apple.com') {
    const trackId = url.searchParams.get('i');
    if (trackId) return { platformSlug: 'apple-music', externalId: trackId };
    if (segments.includes('song') && /^\d+$/.test(segments.at(-1) ?? ''))
      return { platformSlug: 'apple-music', externalId: segments.at(-1)! };
  }

  // FLO: https://m.music-flo.com/detail/track/{id}
  if (
    (host === 'm.music-flo.com' || host === 'music-flo.com') &&
    segments[0] === 'detail' &&
    segments[1] === 'track' &&
    segments[2]
  ) {
    return { platformSlug: 'flo', externalId: segments[2] };
  }

  // Genie: https://www.genie.co.kr/detail/songInfo?xgnm={id}
  if (
    (host === 'genie.co.kr' || host === 'm.genie.co.kr') &&
    segments[0] === 'detail' &&
    segments[1] === 'songInfo'
  ) {
    const songId = url.searchParams.get('xgnm');
    if (songId) return { platformSlug: 'genie', externalId: songId };
  }

  // Melon: https://www.melon.com/song/detail.htm?songId={id}
  if (host === 'melon.com' || host === 'm2.melon.com' || host === 'm.melon.com') {
    const songId = url.searchParams.get('songId');
    if (songId) return { platformSlug: 'melon', externalId: songId };
  }

  throw new BadRequestException('지원하지 않는 URL 형식입니다');
}
