import { musicFetch } from './music-fetch';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TrackMetadata } from './track-metadata';
import { isEvidenceMatch } from '../track-match-verifier';

/** Spotify Web API 의 track 객체 (필요한 필드만) */
interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  external_ids?: { isrc?: string };
  external_urls?: { spotify?: string };
  artists: { name: string }[];
  album?: {
    name?: string;
    release_date?: string;
    images?: { url: string }[];
  };
}

/**
 * Spotify Web API 클라이언트 (Client Credentials 흐름)
 * 토큰은 인스턴스에 캐싱함 — Lambda 컨테이너 재사용 시 재발급을 피하기 위함
 */
@Injectable()
export class SpotifyClient {
  private readonly logger = new Logger(SpotifyClient.name);
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Spotify 트랙 ID → 메타데이터 */
  async getTrack(id: string): Promise<TrackMetadata | null> {
    const res = await this.authedFetch(`https://api.spotify.com/v1/tracks/${id}`);
    if (!res.ok) {
      this.logger.warn(`Spotify getTrack 실패: ${res.status}`);
      return null;
    }
    return this.toMetadata((await res.json()) as SpotifyTrack);
  }

  /** ISRC 로 트랙 검색 (크로스 플랫폼 매칭의 1순위 키) */
  async searchByIsrc(isrc: string): Promise<TrackMetadata | null> {
    return this.searchFirst(`isrc:${isrc}`);
  }

  /** 제목 + 아티스트 텍스트 검색 (ISRC 가 없을 때 폴백) */
  async searchByText(title: string, artist: string): Promise<TrackMetadata | null> {
    return this.searchFirst(`${title} ${artist}`, title, artist);
  }

  async searchCandidates(
    source: Pick<TrackMetadata, 'title' | 'artist'>,
  ): Promise<TrackMetadata[]> {
    return this.searchResults(source.title + ' ' + source.artist);
  }

  private async searchFirst(
    query: string,
    title?: string,
    artist?: string,
  ): Promise<TrackMetadata | null> {
    const candidates = await this.searchResults(query);
    if (!title)
      return (
        candidates.find((track) => track.isrc?.toUpperCase() === query.slice(5).toUpperCase()) ??
        null
      );
    return (
      candidates.find((track) =>
        isEvidenceMatch(
          {
            ...track,
            title,
            artist: artist ?? '',
            isrc: null,
            durationMs: null,
            releaseDate: null,
          },
          track,
        ),
      ) ?? null
    );
  }

  private async searchResults(query: string): Promise<TrackMetadata[]> {
    const res = await this.authedFetch(
      'https://api.spotify.com/v1/search?q=' + encodeURIComponent(query) + '&type=track&limit=10',
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { tracks?: { items?: SpotifyTrack[] } };
    return (data.tracks?.items ?? []).map((track) => this.toMetadata(track));
  }

  private toMetadata(track: SpotifyTrack): TrackMetadata {
    return {
      platformSlug: 'spotify',
      externalId: track.id,
      url: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
      isrc: track.external_ids?.isrc ?? null,
      title: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      album: track.album?.name ?? null,
      releaseDate: normalizeDate(track.album?.release_date),
      durationMs: track.duration_ms ?? null,
      thumbnailUrl: track.album?.images?.[0]?.url ?? null,
    };
  }

  /** 액세스 토큰을 붙여 요청 — 만료 시 자동 재발급 */
  private async authedFetch(url: string): Promise<Response> {
    const token = await this.getAccessToken();
    return musicFetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) {
      return this.token.value;
    }

    const { clientId, clientSecret } = this.config.get('track.spotify')!;
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await musicFetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });
    if (!res.ok) {
      throw new Error(`Spotify 토큰 발급 실패: ${res.status}`);
    }

    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = {
      value: json.access_token,
      // 만료 60초 전에 갱신하도록 여유를 둠
      expiresAt: Date.now() + (json.expires_in - 60) * 1000,
    };
    return this.token.value;
  }
}

/** Spotify release_date 는 'YYYY' / 'YYYY-MM' / 'YYYY-MM-DD' — 완전한 일자만 채택 */
function normalizeDate(raw: string | undefined): string | null {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}
