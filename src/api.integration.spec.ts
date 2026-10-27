import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { DRIZZLE, DrizzleDB } from './database/database.module';
import { platforms, sharedLinks, tracks, users } from './database/schema';
import { TokenService } from './auth/token.service';
import { AuthService } from './auth/auth.service';
import { OAuthService } from './auth/oauth/oauth.service';
import { TrackMetadata } from './tracks/providers/track-metadata';
import { SpotifyClient } from './tracks/providers/spotify.client';
import { YouTubeClient } from './tracks/providers/youtube.client';
import { AppleMusicClient } from './tracks/providers/apple-music.client';
import { FloClient } from './tracks/providers/flo.client';
import { GenieClient } from './tracks/providers/genie.client';
import { MelonClient } from './tracks/providers/melon.client';
import { eq } from 'drizzle-orm';
import { setupApp } from './setup';
import { ProfileImageService } from './users/profile-image.service';

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

integration('Spring-compatible API with real PostgreSQL', () => {
  let app: INestApplication, db: DrizzleDB, base: string, access: string, ownerId: number;
  const source: TrackMetadata = {
    platformSlug: 'spotify',
    externalId: 'track123',
    url: 'https://open.spotify.com/track/track123',
    isrc: 'TEST00000001',
    title: 'Morning',
    artist: 'Original Artist',
    album: 'Album',
    durationMs: 180000,
    releaseDate: '2026-01-01',
    thumbnailUrl: null,
  };
  const spotify = {
    getTrack: jest.fn().mockResolvedValue(source),
    searchByIsrc: jest.fn(),
    searchByText: jest.fn(),
  };
  const apple = {
    searchByText: jest.fn().mockResolvedValue({
      ...source,
      platformSlug: 'apple-music',
      externalId: '123',
      url: 'https://music.apple.com/kr/song/123',
      isrc: null,
    }),
  };
  const empty = { searchTrack: jest.fn().mockResolvedValue(null) };

  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/playona_test')
      throw new Error('Use a disposable local playona_test database');
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.DATABASE_POOL_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET = 'integration-test-secret-at-least-32-characters';
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'https://playona-five.vercel.app';
    process.env.SHARE_BASE_URL = 'https://playona-five.vercel.app';
    const client = postgres(process.env.TEST_DATABASE_URL!, { max: 1, onnotice: () => undefined });
    try {
      await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
      await client.unsafe(
        'TRUNCATE users, platforms, tracks, refresh_tokens, shared_links, platform_tracks, user_platform_preferences RESTART IDENTITY CASCADE',
      );
    } finally {
      await client.end();
    }
    const { AppModule } = await import('./app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SpotifyClient)
      .useValue(spotify)
      .overrideProvider(AppleMusicClient)
      .useValue(apple)
      .overrideProvider(YouTubeClient)
      .useValue(empty)
      .overrideProvider(FloClient)
      .useValue(empty)
      .overrideProvider(GenieClient)
      .useValue(empty)
      .overrideProvider(MelonClient)
      .useValue(empty)
      .overrideProvider(ProfileImageService)
      .useValue({ upload: jest.fn().mockResolvedValue('https://images.example.com/profile.png') })
      .compile();
    app = module.createNestApplication({ logger: false });
    setupApp(app);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    db = app.get(DRIZZLE);
    await db.insert(platforms).values([
      { name: 'Spotify', slug: 'spotify' },
      { name: 'Apple Music', slug: 'apple-music' },
    ]);
    const [owner] = await db
      .insert(users)
      .values({
        email: 'test@example.com',
        nickname: 'Owner',
        provider: 'google',
        providerId: 'owner',
      })
      .returning();
    ownerId = owner.id;
    access = (await app.get(TokenService).issueTokens(ownerId)).accessToken;
  }, 30000);
  afterAll(async () => {
    await app?.close();
  });

  async function request<T>(path: string, method = 'GET', body?: unknown, token?: string) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    return {
      status: res.status,
      body: JSON.parse(await res.text()) as { success: boolean; data: T; message?: string },
    };
  }

  it('wraps public and unauthorized responses in the frontend envelope', async () => {
    const cors = await fetch(`${base}/api/platforms`, {
      headers: { Origin: 'https://playona-five.vercel.app' },
    });
    expect(cors.headers.get('access-control-allow-origin')).toBe('https://playona-five.vercel.app');
    expect(cors.headers.get('access-control-allow-credentials')).toBe('true');
    expect(await request('/api/platforms')).toMatchObject({
      status: 200,
      body: { success: true, data: expect.any(Array) },
    });
    expect(await request('/api/users/me')).toMatchObject({
      status: 401,
      body: { success: false, data: null },
    });
  });

  it('creates a new track from a URL, reuses the link and returns flat Spring fields', async () => {
    const created = await request<{ shortCode: string }>(
      '/api/links',
      'POST',
      { url: source.url },
      access,
    );
    expect(created).toMatchObject({
      status: 200,
      body: {
        success: true,
        data: {
          trackTitle: source.title,
          trackArtist: source.artist,
          shareUrl: expect.stringContaining('/t/'),
          platforms: expect.arrayContaining([
            expect.objectContaining({
              slug: 'apple',
              url: expect.stringContaining('music.apple.com'),
            }),
          ]),
        },
      },
    });
    const reused = await request<{ shortCode: string }>(
      '/api/links',
      'POST',
      { url: source.url },
      access,
    );
    expect(reused.body.data.shortCode).toBe(created.body.data.shortCode);
    expect(spotify.getTrack).toHaveBeenCalledTimes(1);
    expect(await db.select().from(tracks)).toHaveLength(1);
    expect(await db.select().from(sharedLinks)).toHaveLength(1);
  });

  it('accepts the frontend preference array, validates duplicates and rolls back rejected changes', async () => {
    expect(
      await request('/api/users/me/platforms', 'PUT', [{ platformId: 2, priority: 1 }], access),
    ).toMatchObject({ status: 200, body: { data: [{ platformId: 2, priority: 1 }] } });
    expect(
      (
        await request(
          '/api/users/me/platforms',
          'PUT',
          [
            { platformId: 2, priority: 1 },
            { platformId: 2, priority: 2 },
          ],
          access,
        )
      ).status,
    ).toBe(400);
    expect(
      (await request('/api/users/me/platforms', 'PUT', [{ platformId: 9999, priority: 1 }], access))
        .status,
    ).toBe(400);
    expect(await request('/api/users/me/platforms', 'GET', undefined, access)).toMatchObject({
      body: { data: [{ platformId: 2, priority: 1 }] },
    });
  });

  it('accepts the frontend multipart profile-image field and updates the profile', async () => {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }),
      'avatar.png',
    );
    const res = await fetch(`${base}/api/users/me/profile-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}` },
      body: form,
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(await res.text())).toMatchObject({
      success: true,
      data: { profileImageUrl: 'https://images.example.com/profile.png' },
    });
  });

  it('returns JSON redirects, counts clicks and protects delete/rematch ownership', async () => {
    const [link] = await db.select().from(sharedLinks);
    expect(await request(`/api/links/${link.shortCode}/platforms`)).toMatchObject({
      status: 200,
      body: { data: expect.any(Array) },
    });
    expect(
      await request(`/api/links/${link.shortCode}/redirect`, 'GET', undefined, access),
    ).toMatchObject({
      status: 200,
      body: { data: { url: expect.stringContaining('music.apple.com') } },
    });
    expect(await request(`/api/links/${link.shortCode}/redirect`)).toMatchObject({
      status: 200,
      body: { data: expect.any(Array) },
    });
    const [clicked] = await db.select().from(sharedLinks).where(eq(sharedLinks.id, link.id));
    expect(clicked.clickCount).toBe(2);
    const [other] = await db
      .insert(users)
      .values({
        email: 'other@example.com',
        nickname: 'Other',
        provider: 'google',
        providerId: 'other',
      })
      .returning();
    const token = (await app.get(TokenService).issueTokens(other.id)).accessToken;
    expect((await request(`/api/links/${link.shortCode}`, 'DELETE', undefined, token)).status).toBe(
      404,
    );
    expect(
      (await request(`/api/links/${link.shortCode}/rematch`, 'POST', undefined, token)).status,
    ).toBe(404);
    expect(
      (await request(`/api/links/${link.shortCode}/rematch`, 'POST', undefined, access)).status,
    ).toBe(200);
    expect(spotify.getTrack).toHaveBeenCalledTimes(2);
    expect(
      (await request(`/api/links/${link.shortCode}`, 'DELETE', undefined, access)).status,
    ).toBe(200);
    expect((await request(`/api/links/${link.shortCode}`)).status).toBe(404);
  });

  it('rotates same-second refresh tokens once and rejects concurrent reuse', async () => {
    const original = await app.get(TokenService).issueTokens(ownerId);
    const responses = await Promise.all(
      [1, 2].map(() =>
        request<{ refreshToken: string }>('/api/auth/refresh', 'POST', {
          refreshToken: original.refreshToken,
        }),
      ),
    );
    expect(responses.map((res) => res.status).sort()).toEqual([200, 401]);
    const rotated = responses.find((res) => res.status === 200)!;
    expect(rotated.body.data.refreshToken).not.toBe(original.refreshToken);
    const jwt = new JwtService({ secret: app.get(ConfigService).get('jwt.secret') });
    expect(jwt.verify(rotated.body.data.refreshToken).type).toBe('refresh');
    expect(
      (await request('/api/users/me', 'GET', undefined, rotated.body.data.refreshToken)).status,
    ).toBe(401);
  });

  it('upserts concurrent logins and separates equal IDs from different OAuth providers', async () => {
    const profile = {
      providerId: 'shared-provider-id',
      email: 'oauth@example.com',
      nickname: 'OAuth',
      profileImageUrl: null,
    };
    const oauth = app.get(OAuthService);
    const google = jest
      .spyOn(oauth, 'getGoogleProfile')
      .mockResolvedValue({ ...profile, provider: 'google' });
    const kakao = jest
      .spyOn(oauth, 'getKakaoProfile')
      .mockResolvedValue({ ...profile, provider: 'kakao' });
    try {
      const auth = app.get(AuthService);
      await Promise.all([
        auth.loginWithGoogle('fake'),
        auth.loginWithGoogle('fake'),
        auth.loginWithKakao('fake'),
      ]);
      const rows = await db.select().from(users).where(eq(users.providerId, profile.providerId));
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.provider).sort()).toEqual(['google', 'kakao']);
    } finally {
      google.mockRestore();
      kakao.mockRestore();
    }
  });

  it('keeps OAuth start aliases compatible and rejects callbacks without state cookies', async () => {
    const res = await fetch(`${base}/oauth2/authorization/google`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    const target = new URL(res.headers.get('location')!);
    expect(target.searchParams.get('state')).toMatch(/^[a-f0-9]{64}$/);
    expect(res.headers.get('set-cookie')).toContain('HttpOnly');
    const invalid = await fetch(
      `${base}/api/auth/google/callback?code=fake&state=${target.searchParams.get('state')}`,
      { redirect: 'manual' },
    );
    expect(invalid.headers.get('location')).toContain('error=invalid_state');
  });
});
