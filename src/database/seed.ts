/**
 * npm run db:seed로 실행 할 초기 플랫폼 데이터 시드
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { platforms } from './schema';

const SEED_PLATFORMS = [
  { name: 'Spotify', slug: 'spotify', logoUrl: null, isActive: true },
  { name: 'YouTube Music', slug: 'youtube-music', logoUrl: null, isActive: true },
  { name: 'Apple Music', slug: 'apple-music', logoUrl: null, isActive: true },
  { name: 'FLO', slug: 'flo', logoUrl: null, isActive: true },
  { name: 'Genie Music', slug: 'genie', logoUrl: null, isActive: true },
  { name: 'Melon', slug: 'melon', logoUrl: null, isActive: true },
];

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 환경변수가 필요합니다.');

  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client);

  await db.insert(platforms).values(SEED_PLATFORMS).onConflictDoNothing();
  console.log(`✅ 플랫폼 ${SEED_PLATFORMS.length}건 시드 완료`);

  await client.end();
}

seed().catch((err) => {
  console.error('❌ 시드 실패:', err);
  process.exit(1);
});
