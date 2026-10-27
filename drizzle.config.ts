import { defineConfig } from 'drizzle-kit';

/**
 * 마이그레이션 생성·적용 설정
 * 마이그레이션은 다이렉트 커넥션(DATABASE_URL)을 사용함 — 풀러 경유 X
 */
export default defineConfig({
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
});
