import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../database/database.module';
import { platforms, userPlatformPreferences, users } from '../database/schema';
import {
  PlatformPreferenceItemDto,
  PlatformPreferenceResponseDto,
  UpdateUserDto,
  UserResponseDto,
} from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getMe(userId: number): Promise<UserResponseDto> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }
    return {
      userUuid: user.userUuid,
      email: user.email,
      nickname: user.nickname,
      profileImageUrl: user.profileImageUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateMe(userId: number, dto: UpdateUserDto): Promise<UserResponseDto> {
    const [updated] = await this.db
      .update(users)
      .set({
        ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
        ...(dto.profileImageUrl !== undefined ? { profileImageUrl: dto.profileImageUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }
    return {
      userUuid: updated.userUuid,
      email: updated.email,
      nickname: updated.nickname,
      profileImageUrl: updated.profileImageUrl,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async getPreferences(userId: number): Promise<PlatformPreferenceResponseDto[]> {
    const rows = await this.db
      .select({
        platformId: userPlatformPreferences.platformId,
        platformName: platforms.name,
        priority: userPlatformPreferences.priority,
      })
      .from(userPlatformPreferences)
      .innerJoin(platforms, eq(userPlatformPreferences.platformId, platforms.id))
      .where(eq(userPlatformPreferences.userId, userId))
      .orderBy(asc(userPlatformPreferences.priority));

    return rows;
  }

  /** 선호 플랫폼을 통째로 교체 (delete-all 후 insert) */
  async updatePreferences(
    userId: number,
    items: PlatformPreferenceItemDto[],
  ): Promise<PlatformPreferenceResponseDto[]> {
    const ids = items.map((item) => item.platformId);
    if (
      new Set(ids).size !== ids.length ||
      new Set(items.map((item) => item.priority)).size !== items.length
    ) {
      throw new BadRequestException('플랫폼과 우선순위는 중복될 수 없습니다');
    }
    if (ids.length) {
      const valid = await this.db
        .select({ id: platforms.id })
        .from(platforms)
        .where(and(inArray(platforms.id, ids), eq(platforms.isActive, true)));
      if (valid.length !== ids.length) throw new BadRequestException('지원하지 않는 플랫폼입니다');
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(userPlatformPreferences).where(eq(userPlatformPreferences.userId, userId));

      if (items.length > 0) {
        await tx.insert(userPlatformPreferences).values(
          items.map((it) => ({
            userId,
            platformId: it.platformId,
            priority: it.priority,
          })),
        );
      }
    });

    return this.getPreferences(userId);
  }
}
