import { GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../database/database.module';
import {
  platformTracks,
  platforms,
  sharedLinks,
  tracks,
  userPlatformPreferences,
} from '../database/schema';
import { TracksService } from '../tracks/tracks.service';
import { SharedLinkResponseDto } from './dto/link.dto';
import { generateShortCode } from './short-code.util';

@Injectable()
export class LinksService {
  constructor(
    private readonly tracksService: TracksService,
    private readonly config: ConfigService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  /** URL 로부터 곡을 찾아 공유 링크를 생성 (비로그인 시 userId=null) */
  async create(url: string, userId: number | null): Promise<SharedLinkResponseDto> {
    const resolved = await this.tracksService.resolveByUrl(url);
    const [track] = await this.db
      .select({ id: tracks.id })
      .from(tracks)
      .where(eq(tracks.trackUuid, resolved.trackUuid))
      .limit(1);
    if (!track) throw new NotFoundException('곡을 찾을 수 없습니다');
    const link = await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${track.id}:${userId ?? 'anonymous'}`}, 0))`,
      );
      const [existing] = await tx
        .select()
        .from(sharedLinks)
        .where(
          and(
            eq(sharedLinks.trackId, track.id),
            userId === null ? isNull(sharedLinks.userId) : eq(sharedLinks.userId, userId),
          ),
        )
        .limit(1);
      if (existing) return existing;
      for (let attempt = 0; attempt < 5; attempt++) {
        const [created] = await tx
          .insert(sharedLinks)
          .values({ shortCode: generateShortCode(), trackId: track.id, userId })
          .onConflictDoNothing({ target: sharedLinks.shortCode })
          .returning();
        if (created) return created;
      }
      throw new Error('short code 생성에 실패했습니다');
    });

    return this.toResponse(link);
  }

  /** 내가 만든 링크 목록 */
  async findMine(userId: number): Promise<SharedLinkResponseDto[]> {
    const rows = await this.db
      .select()
      .from(sharedLinks)
      .where(eq(sharedLinks.userId, userId))
      .orderBy(desc(sharedLinks.createdAt));

    return Promise.all(rows.map((row) => this.toResponse(row)));
  }

  /** shortCode 로 링크 조회 */
  async findByShortCode(shortCode: string): Promise<SharedLinkResponseDto> {
    const link = await this.getLinkOrThrow(shortCode);
    return this.toResponse(link);
  }

  async getPlatformUrls(shortCode: string) {
    return (await this.findByShortCode(shortCode)).platforms;
  }

  async delete(shortCode: string, userId: number): Promise<void> {
    const deleted = await this.db
      .delete(sharedLinks)
      .where(and(eq(sharedLinks.shortCode, shortCode), eq(sharedLinks.userId, userId)))
      .returning({ id: sharedLinks.id });
    if (!deleted.length) throw new NotFoundException('링크를 찾을 수 없거나 삭제 권한이 없습니다');
  }

  async rematch(shortCode: string, userId: number): Promise<SharedLinkResponseDto> {
    const link = await this.getLinkOrThrow(shortCode);
    if (link.userId !== userId) throw new NotFoundException('재매칭 권한이 없습니다');
    await this.tracksService.rematch(link.trackId);
    return this.toResponse(link);
  }

  async redirect(shortCode: string, userId: number | null, platformSlug?: string) {
    const url = await this.resolveRedirect(shortCode, userId, platformSlug);
    return userId !== null || platformSlug ? { url } : this.getPlatformUrls(shortCode);
  }

  /**
   * 리디렉션 대상 플랫폼 URL 을 결정함
   * - platform 파라미터 지정 시 해당 플랫폼
   * - 로그인 유저: 선호 플랫폼 우선순위대로 가용한 첫 매칭
   * - 그 외: 첫 번째 가용 플랫폼
   * 만료된 링크는 410
   */
  async resolveRedirect(
    shortCode: string,
    userId: number | null,
    platformSlug?: string,
  ): Promise<string> {
    const link = await this.getLinkOrThrow(shortCode);

    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      throw new GoneException('만료된 링크입니다');
    }

    const available = await this.db
      .select({ slug: platforms.slug, url: platformTracks.url })
      .from(platformTracks)
      .innerJoin(platforms, eq(platformTracks.platformId, platforms.id))
      .where(and(eq(platformTracks.trackId, link.trackId), eq(platformTracks.isAvailable, true)));

    if (available.length === 0) {
      throw new NotFoundException('재생 가능한 플랫폼이 없습니다');
    }

    // 클릭 수 증가 (리디렉션 성공 경로에서만)
    await this.db
      .update(sharedLinks)
      .set({ clickCount: sql`${sharedLinks.clickCount} + 1` })
      .where(eq(sharedLinks.id, link.id));

    if (platformSlug) {
      const picked = available.find((a) => a.slug === platformSlug);
      if (picked) return picked.url;
    }

    if (userId) {
      const prefs = await this.db
        .select({ slug: platforms.slug })
        .from(userPlatformPreferences)
        .innerJoin(platforms, eq(userPlatformPreferences.platformId, platforms.id))
        .where(eq(userPlatformPreferences.userId, userId))
        .orderBy(userPlatformPreferences.priority);

      for (const pref of prefs) {
        const picked = available.find((a) => a.slug === pref.slug);
        if (picked) return picked.url;
      }
    }

    const [track] = await this.db
      .select({ sourceUrl: tracks.sourceUrl })
      .from(tracks)
      .where(eq(tracks.id, link.trackId))
      .limit(1);
    return track?.sourceUrl ?? available[0].url;
  }

  private async getLinkOrThrow(shortCode: string) {
    const [link] = await this.db
      .select()
      .from(sharedLinks)
      .where(eq(sharedLinks.shortCode, shortCode))
      .limit(1);

    if (!link) {
      throw new NotFoundException('링크를 찾을 수 없습니다');
    }
    if (link.expiresAt && link.expiresAt.getTime() < Date.now())
      throw new GoneException('만료된 링크입니다');
    return link;
  }

  private async toResponse(link: typeof sharedLinks.$inferSelect): Promise<SharedLinkResponseDto> {
    const track = await this.tracksService.findByTrackId(link.trackId);
    const baseUrl = this.config.get<string>('shareBaseUrl');
    return {
      linkUuid: link.linkUuid,
      shortCode: link.shortCode,
      shareUrl: `${baseUrl}/t/${link.shortCode}`,
      track,
      trackTitle: track.title,
      trackArtist: track.artist,
      thumbnailUrl: track.thumbnailUrl ?? '',
      platforms: track.platformTracks
        .filter((item) => item.isAvailable)
        .map((item) => ({
          slug:
            item.platform === 'youtube-music'
              ? 'ytmusic'
              : item.platform === 'apple-music'
                ? 'apple'
                : item.platform,
          name: item.name,
          url: item.url,
          thumbnailUrl: track.thumbnailUrl ?? '',
        })),
      clickCount: link.clickCount,
      createdAt: link.createdAt.toISOString(),
    };
  }
}
