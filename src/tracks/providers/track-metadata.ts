/**
 * 플랫폼별 API 응답을 통일한 정규화 트랙 메타데이터
 * Spotify / YouTube 등 각 클라이언트가 이 형태로 변환해 반환함
 */
export interface TrackMetadata {
  /** 플랫폼 slug (DB platforms.slug 와 일치) */
  platformSlug: string;
  /** 플랫폼 내 곡/영상 식별자 */
  externalId: string;
  /** 플랫폼 재생 URL */
  url: string;
  /** 국제 표준 녹음 코드 — 크로스 플랫폼 매칭 키, 없으면 null */
  isrc: string | null;
  title: string;
  artist: string;
  album: string | null;
  /** YYYY-MM-DD, 정확한 일자를 모르면 null */
  releaseDate: string | null;
  durationMs: number | null;
  thumbnailUrl: string | null;
}
