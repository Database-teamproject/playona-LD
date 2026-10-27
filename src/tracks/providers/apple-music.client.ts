import { musicFetch } from './music-fetch';
import { Injectable, Logger } from '@nestjs/common';
import { TrackMetadata } from './track-metadata';
import { isEvidenceMatch } from '../track-match-verifier';

/** iTunes Search API 의 song 결과 (필요한 필드만) */
interface ITunesSong {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  trackViewUrl?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
  artworkUrl100?: string;
  kind?: string;
}

/**
 * Apple Music 클라이언트 — Apple 의 공개 iTunes Search API 사용 (키 불필요)
 * 비공식 스크래핑 라이브러리보다 안정적이며, country=KR 로 국내 Apple Music 링크를 반환함
 * 단, iTunes Search API 는 ISRC 검색을 지원하지 않아 매칭은 텍스트 기반임
 */
@Injectable()
export class AppleMusicClient {
  private readonly logger = new Logger(AppleMusicClient.name);
  private readonly country = 'KR';

  /** Apple Music 트랙 ID → 메타데이터 (lookup) */
  async getTrack(id: string): Promise<TrackMetadata | null> {
    const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&entity=song&country=${this.country}`;
    const song = await this.fetchFirstSong(url, 'getTrack');
    return song ? this.toMetadata(song) : null;
  }

  /** 제목 + 아티스트 텍스트 검색 */
  async searchByText(title: string, artist: string): Promise<TrackMetadata | null> {
    return (
      (await this.searchCandidates({ title, artist })).find((track) =>
        isEvidenceMatch(
          { ...track, title, artist, isrc: null, durationMs: null, releaseDate: null },
          track,
        ),
      ) ?? null
    );
  }

  async searchCandidates({
    title,
    artist,
  }: Pick<TrackMetadata, 'title' | 'artist'>): Promise<TrackMetadata[]> {
    const res = await musicFetch(
      'https://itunes.apple.com/search?term=' +
        encodeURIComponent(title + ' ' + artist) +
        '&entity=song&limit=20&country=' +
        this.country,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: ITunesSong[] };
    return (data.results ?? [])
      .filter((song) => song.kind === 'song')
      .map((song) => this.toMetadata(song));
  }

  private async fetchFirstSong(url: string, label: string): Promise<ITunesSong | null> {
    const res = await musicFetch(url);
    if (!res.ok) {
      this.logger.warn(`iTunes ${label} 실패: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { results?: ITunesSong[] };
    // lookup 결과에는 앨범 등 다른 wrapperType 이 섞일 수 있어 song 만 채택
    return data.results?.find((r) => r.kind === 'song') ?? null;
  }

  private toMetadata(song: ITunesSong): TrackMetadata {
    return {
      platformSlug: 'apple-music',
      externalId: String(song.trackId),
      url: song.trackViewUrl ?? '',
      isrc: null,
      title: song.trackName,
      artist: song.artistName,
      album: song.collectionName ?? null,
      releaseDate: song.releaseDate?.slice(0, 10) ?? null,
      durationMs: song.trackTimeMillis ?? null,
      // 100x100 썸네일 URL 을 고해상도로 치환
      thumbnailUrl: song.artworkUrl100?.replace('100x100bb', '600x600bb') ?? null,
    };
  }
}
