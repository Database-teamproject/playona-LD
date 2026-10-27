import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../database/database.module';
import { platformTracks, platforms, tracks } from '../database/schema';
import { TrackResponseDto } from './dto/track.dto';
import { AppleMusicClient } from './providers/apple-music.client';
import { FloClient } from './providers/flo.client';
import { GenieClient } from './providers/genie.client';
import { MelonClient } from './providers/melon.client';
import { parseTrackUrl } from './track-url.util';
import { SpotifyClient } from './providers/spotify.client';
import { YouTubeClient } from './providers/youtube.client';
import { TrackMetadata } from './providers/track-metadata';
import { isEvidenceMatch, isKoreanReleaseMatch } from './track-match-verifier';
import { withMusicDeadline } from './providers/music-fetch';
import { AiMatchAdvisor } from './ai-match-advisor';

/** parseTrackUrl 의 slug 를 DB 에 적재된 플랫폼 slug 로 정규화 (youtube → youtube-music) */
function normalizeSlug(slug: string): string {
  return slug === 'youtube' ? 'youtube-music' : slug;
}

function primaryPlatformRank(slug: string): number {
  switch (normalizeSlug(slug)) {
    case 'spotify':
      return 0;
    case 'apple-music':
      return 1;
    case 'melon':
      return 2;
    case 'genie':
      return 3;
    case 'flo':
      return 4;
    case 'youtube-music':
      return 5;
    default:
      return 99;
  }
}

@Injectable()
export class TracksService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly spotify: SpotifyClient,
    private readonly youtube: YouTubeClient,
    private readonly appleMusic: AppleMusicClient,
    private readonly flo: FloClient,
    private readonly genie: GenieClient,
    private readonly melon: MelonClient,
    private readonly ai: AiMatchAdvisor,
  ) {}

  /**
   * 플랫폼 URL → 곡 메타데이터 + 플랫폼별 매칭 결과
   * 이미 적재된 곡이면 DB 에서 즉시 반환하고, 신규 URL 이면 외부 API 로 수집한 뒤
   * ISRC(없으면 제목+아티스트) 기준으로 다른 플랫폼을 교차 매칭해 적재함
   */
  async resolveByUrl(url: string, force = false): Promise<TrackResponseDto> {
    return withMusicDeadline(() => this.resolve(url, force), force);
  }

  private async resolve(url: string, force: boolean): Promise<TrackResponseDto> {
    const parsed = parseTrackUrl(url);
    const sourceSlug = normalizeSlug(parsed.platformSlug);

    // 1. 이미 적재된 곡이면 캐시처럼 즉시 반환
    const cached = await this.findCachedByExternalId(sourceSlug, parsed.externalId);
    if (cached && !force) {
      const [stored] = await this.db
        .select({ matchedAt: tracks.matchedAt })
        .from(tracks)
        .where(eq(tracks.trackUuid, cached.trackUuid))
        .limit(1);
      if (stored?.matchedAt && Date.now() - stored.matchedAt.getTime() < 60_000) return cached;
    }

    // 2. 소스 플랫폼에서 메타데이터 수집
    let source: TrackMetadata;
    try {
      source = await this.fetchSource(sourceSlug, parsed.externalId);
    } catch (error) {
      if (cached && !force) return cached;
      throw error;
    }

    // 3. 다른 플랫폼 교차 매칭 (best-effort — 실패해도 무시)
    const collected = await this.collectMatches(sourceSlug, source);

    // 4. 적재 후 응답 구성
    const trackId = await this.persistTrack(collected, source.url, cached?.trackUuid);
    return this.findByTrackId(trackId);
  }

  async rematch(trackId: number): Promise<void> {
    const [track] = await this.db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1);
    if (!track) throw new NotFoundException('곡을 찾을 수 없습니다');
    let source = track.sourceUrl;
    if (!source) {
      const [row] = await this.db
        .select({ url: platformTracks.url })
        .from(platformTracks)
        .where(eq(platformTracks.trackId, trackId))
        .limit(1);
      source = row?.url ?? null;
    }
    if (!source) throw new NotFoundException('원본 곡 URL을 찾을 수 없습니다');
    await this.resolveByUrl(source, true);
  }

  /** trackUuid 로 곡 상세 조회 */
  async findByUuid(trackUuid: string): Promise<TrackResponseDto> {
    const [track] = await this.db
      .select()
      .from(tracks)
      .where(eq(tracks.trackUuid, trackUuid))
      .limit(1);

    if (!track) {
      throw new NotFoundException('곡을 찾을 수 없습니다');
    }
    return this.findByTrackId(track.id);
  }

  /** 내부 id 기준 곡 + 플랫폼 매칭 조립 (다른 모듈에서 재사용) */
  async findByTrackId(trackId: number): Promise<TrackResponseDto> {
    const [track] = await this.db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1);
    if (!track) {
      throw new NotFoundException('곡을 찾을 수 없습니다');
    }

    const rows = await this.db
      .select({
        platform: platforms.slug,
        name: platforms.name,
        url: platformTracks.url,
        isAvailable: platformTracks.isAvailable,
      })
      .from(platformTracks)
      .innerJoin(platforms, eq(platformTracks.platformId, platforms.id))
      .where(eq(platformTracks.trackId, trackId));

    return {
      trackId: track.id,
      sourceUrl: track.sourceUrl,
      trackUuid: track.trackUuid,
      isrc: track.isrc,
      title: track.title,
      artist: track.artist,
      album: track.album,
      releaseDate: track.releaseDate,
      durationMs: track.durationMs,
      thumbnailUrl: track.thumbnailUrl,
      platformTracks: rows,
    };
  }

  /** 소스 플랫폼 API 에서 곡 메타데이터를 가져옴 */
  private async fetchSource(slug: string, externalId: string): Promise<TrackMetadata> {
    let meta: TrackMetadata | null = null;
    if (slug === 'spotify') {
      meta = await this.spotify.getTrack(externalId);
    } else if (slug === 'youtube-music') {
      meta = await this.youtube.getVideo(externalId);
    } else if (slug === 'apple-music') {
      meta = await this.appleMusic.getTrack(externalId);
    } else if (slug === 'flo') {
      meta = await this.flo.getTrack(externalId);
    } else if (slug === 'genie') {
      meta = await this.genie.getTrack(externalId);
    } else if (slug === 'melon') {
      meta = await this.melon.getTrack(externalId);
    } else {
      throw new BadRequestException(`아직 메타데이터 수집을 지원하지 않는 플랫폼입니다 (${slug})`);
    }

    if (!meta) {
      throw new NotFoundException('해당 URL 의 곡을 찾을 수 없습니다');
    }
    return meta;
  }

  /** 소스 외 플랫폼을 교차 검색해 매칭 목록과 ISRC 를 모음 */
  private async collectMatches(
    sourceSlug: string,
    source: TrackMetadata,
  ): Promise<{ isrc: string | null; all: TrackMetadata[] }> {
    const all: TrackMetadata[] = [source];
    let isrc = source.isrc;

    if (sourceSlug !== 'spotify') {
      let sp: TrackMetadata | null;
      if (isrc) {
        sp = await this.spotify.searchByIsrc(isrc).catch(() => null);
      } else {
        sp = await this.spotify.searchByText(source.title, source.artist).catch(() => null);
      }
      if (sp && !isEvidenceMatch(source, sp) && !isKoreanReleaseMatch(source, sp)) sp = null;
      if (this.ai.enabled()) {
        const candidates = await this.spotify.searchCandidates(source).catch(() => []);
        sp = await this.ai.choose(source, 'spotify', candidates, sp);
      }
      if (sp) {
        all.push(sp);
        isrc ??= sp.isrc;
      }
    }

    const reference = all.find((item) => item.platformSlug === 'spotify') ?? source;
    const searches: [string, () => Promise<TrackMetadata | null>][] = [
      ['youtube-music', () => this.youtube.searchTrack(reference.title, reference.artist)],
      ['apple-music', () => this.appleMusic.searchByText(reference.title, reference.artist)],
      ['flo', () => this.flo.searchTrack(reference)],
      ['genie', () => this.genie.searchTrack(reference)],
      ['melon', () => this.melon.searchTrack(reference)],
    ];
    const matches = await Promise.all(
      searches
        .filter(([slug]) => slug !== sourceSlug)
        .map(async ([slug, search]) => {
          const candidate = await search().catch(() => null);
          const baseline =
            candidate &&
            (isEvidenceMatch(reference, candidate) ||
              (slug === 'apple-music' && isKoreanReleaseMatch(reference, candidate)))
              ? candidate
              : null;
          if (!this.ai.enabled()) return baseline;
          const clients = {
            'youtube-music': this.youtube,
            'apple-music': this.appleMusic,
            flo: this.flo,
            genie: this.genie,
            melon: this.melon,
          };
          const client = clients[slug as keyof typeof clients];
          const candidates = await client.searchCandidates(reference).catch(() => []);
          return this.ai.choose(reference, slug, candidates, baseline);
        }),
    );
    for (const match of matches) {
      if (match) all.push(match);
    }

    return { isrc, all };
  }

  /** 곡 + 플랫폼 매칭을 DB 에 적재하고 trackId 를 반환함 (ISRC 기준 upsert) */
  private async persistTrack(
    data: { isrc: string | null; all: TrackMetadata[] },
    sourceUrl: string,
    existingUuid?: string,
  ): Promise<number> {
    const { isrc, all } = data;
    const platformRows = await this.db.select().from(platforms).where(eq(platforms.isActive, true));
    const slugToId = new Map(platformRows.map((p) => [p.slug, p.id]));

    // 대표 메타데이터는 신뢰도 높은 플랫폼 우선으로 선택해
    // 번역된 YouTube 제목이 전체 곡 제목으로 고정되는 문제를 줄임.
    const primary =
      all.find((m) => m.isrc && m.isrc === isrc) ??
      [...all].sort(
        (a, b) => primaryPlatformRank(a.platformSlug) - primaryPlatformRank(b.platformSlug),
      )[0];

    return this.db.transaction(async (tx) => {
      let existingId: number | undefined;
      let isrcOwner: number | undefined;
      if (existingUuid) {
        const [row] = await tx
          .select({ id: tracks.id })
          .from(tracks)
          .where(eq(tracks.trackUuid, existingUuid))
          .limit(1);
        existingId = row?.id;
      }
      if (isrc) {
        const [row] = await tx
          .select({ id: tracks.id })
          .from(tracks)
          .where(eq(tracks.isrc, isrc))
          .limit(1);
        existingId ??= row?.id;
        isrcOwner = row?.id;
      }

      const trackValues = {
        title: primary.title,
        artist: primary.artist,
        album: primary.album,
        releaseDate: primary.releaseDate,
        durationMs: primary.durationMs,
        thumbnailUrl: primary.thumbnailUrl,
        matchedAt: all.length > 1 ? new Date() : null,
      };

      let trackId: number;
      if (existingId) {
        trackId = existingId;
        await tx
          .update(tracks)
          .set({
            ...trackValues,
            sourceUrl: sql`coalesce(${tracks.sourceUrl}, ${sourceUrl})`,
            ...(isrc && (!isrcOwner || isrcOwner === trackId) ? { isrc } : {}),
          })
          .where(eq(tracks.id, trackId));
      } else {
        const [created] = await tx
          .insert(tracks)
          .values({ isrc, sourceUrl, ...trackValues })
          .onConflictDoUpdate({ target: isrc ? tracks.isrc : tracks.sourceUrl, set: trackValues })
          .returning({ id: tracks.id });
        trackId = created.id;
      }

      for (const m of all) {
        const platformId = slugToId.get(normalizeSlug(m.platformSlug));
        if (!platformId) continue;
        await tx
          .insert(platformTracks)
          .values({
            trackId,
            platformId,
            externalId: m.externalId,
            url: m.url,
            isAvailable: true,
          })
          .onConflictDoUpdate({
            target: [platformTracks.trackId, platformTracks.platformId],
            set: { externalId: m.externalId, url: m.url, isAvailable: true },
          });
      }

      return trackId;
    });
  }

  /** 플랫폼 slug + externalId 로 이미 적재된 곡을 찾음 */
  private async findCachedByExternalId(
    slug: string,
    externalId: string,
  ): Promise<TrackResponseDto | null> {
    const [platform] = await this.db
      .select({ id: platforms.id })
      .from(platforms)
      .where(eq(platforms.slug, slug))
      .limit(1);
    if (!platform) return null;

    const [match] = await this.db
      .select({ trackId: platformTracks.trackId })
      .from(platformTracks)
      .where(
        and(eq(platformTracks.platformId, platform.id), eq(platformTracks.externalId, externalId)),
      )
      .limit(1);

    return match ? this.findByTrackId(match.trackId) : null;
  }
}
