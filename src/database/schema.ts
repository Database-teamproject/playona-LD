/**
 * Drizzle ORM 스키마 — 원본 Spring(JPA) 프로젝트의 도메인 + openapi.yaml 명세 기준
 * - 외부 노출 식별자는 uuid, 내부 조인은 bigserial id 사용
 */
import { relations, sql } from 'drizzle-orm';
import {
  bigserial,
  bigint,
  boolean,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** 소셜 로그인 사용자 */
export const users = pgTable(
  'users',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userUuid: uuid('user_uuid').notNull().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    nickname: varchar('nickname', { length: 100 }).notNull(),
    profileImageUrl: text('profile_image_url'),
    provider: varchar('provider', { length: 20 }).notNull(), // kakao | google
    providerId: varchar('provider_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_user_uuid_idx').on(t.userUuid),
    // 같은 provider 내에서 providerId 는 유일
    uniqueIndex('users_provider_idx').on(t.provider, t.providerId),
  ],
);

/** 발급된 refresh token (로그아웃 시 폐기, 재발급 시 검증) */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('refresh_tokens_token_idx').on(t.token)],
);

/** 지원 음악 플랫폼 (Spotify, YouTube Music ...) */
export const platforms = pgTable(
  'platforms',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 50 }).notNull(),
    logoUrl: text('logo_url'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [uniqueIndex('platforms_slug_idx').on(t.slug)],
);

/** 유저별 선호 플랫폼 우선순위 */
export const userPlatformPreferences = pgTable(
  'user_platform_preferences',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platformId: integer('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'cascade' }),
    priority: integer('priority').notNull(),
  },
  (t) => [uniqueIndex('user_platform_pref_idx').on(t.userId, t.platformId)],
);

/** 곡 메타데이터 (ISRC 기준 정규화) */
export const tracks = pgTable(
  'tracks',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    trackUuid: uuid('track_uuid').notNull().defaultRandom(),
    isrc: varchar('isrc', { length: 20 }),
    title: varchar('title', { length: 500 }).notNull(),
    artist: varchar('artist', { length: 500 }).notNull(),
    album: varchar('album', { length: 500 }),
    releaseDate: date('release_date'),
    durationMs: integer('duration_ms'),
    thumbnailUrl: text('thumbnail_url'),
    sourceUrl: text('source_url'),
    matchedAt: timestamp('matched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('tracks_track_uuid_idx').on(t.trackUuid),
    uniqueIndex('tracks_isrc_idx').on(t.isrc),
    uniqueIndex('tracks_source_url_idx').on(t.sourceUrl),
  ],
);

/** 곡 ↔ 플랫폼별 재생 URL 매칭 */
export const platformTracks = pgTable(
  'platform_tracks',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    trackId: bigint('track_id', { mode: 'number' })
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    platformId: integer('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'cascade' }),
    externalId: varchar('external_id', { length: 255 }),
    url: text('url').notNull(),
    isAvailable: boolean('is_available').notNull().default(true),
  },
  (t) => [uniqueIndex('platform_tracks_idx').on(t.trackId, t.platformId)],
);

/** 단축 공유 링크 */
export const sharedLinks = pgTable(
  'shared_links',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    linkUuid: uuid('link_uuid').notNull().defaultRandom(),
    shortCode: varchar('short_code', { length: 16 }).notNull(),
    trackId: bigint('track_id', { mode: 'number' })
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    // 비로그인 생성 가능 → nullable
    userId: bigint('user_id', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
    }),
    clickCount: integer('click_count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('shared_links_short_code_idx').on(t.shortCode)],
);

// ===== relations =====
export const usersRelations = relations(users, ({ many }) => ({
  preferences: many(userPlatformPreferences),
  refreshTokens: many(refreshTokens),
  sharedLinks: many(sharedLinks),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const platformsRelations = relations(platforms, ({ many }) => ({
  preferences: many(userPlatformPreferences),
  platformTracks: many(platformTracks),
}));

export const userPlatformPreferencesRelations = relations(userPlatformPreferences, ({ one }) => ({
  user: one(users, { fields: [userPlatformPreferences.userId], references: [users.id] }),
  platform: one(platforms, {
    fields: [userPlatformPreferences.platformId],
    references: [platforms.id],
  }),
}));

export const tracksRelations = relations(tracks, ({ many }) => ({
  platformTracks: many(platformTracks),
  sharedLinks: many(sharedLinks),
}));

export const platformTracksRelations = relations(platformTracks, ({ one }) => ({
  track: one(tracks, { fields: [platformTracks.trackId], references: [tracks.id] }),
  platform: one(platforms, { fields: [platformTracks.platformId], references: [platforms.id] }),
}));

export const sharedLinksRelations = relations(sharedLinks, ({ one }) => ({
  track: one(tracks, { fields: [sharedLinks.trackId], references: [tracks.id] }),
  user: one(users, { fields: [sharedLinks.userId], references: [users.id] }),
}));

export const schema = {
  users,
  refreshTokens,
  platforms,
  userPlatformPreferences,
  tracks,
  platformTracks,
  sharedLinks,
  usersRelations,
  refreshTokensRelations,
  platformsRelations,
  userPlatformPreferencesRelations,
  tracksRelations,
  platformTracksRelations,
  sharedLinksRelations,
};

// 편의용 타입
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Platform = typeof platforms.$inferSelect;
export type Track = typeof tracks.$inferSelect;
export type SharedLink = typeof sharedLinks.$inferSelect;

export { sql };
