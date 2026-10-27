import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { schema } from './schema';

/** DI 토큰 — 주입 시 `@Inject(DRIZZLE) private readonly db: DrizzleDB` */
export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

/**
 * postgres-js 클라이언트는 모듈 스코프에 캐싱함
 * Lambda 컨테이너 재사용 시 커넥션을 유지해 콜드스타트 비용을 줄이기 위함
 */
let cachedClient: ReturnType<typeof postgres> | undefined;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DrizzleDB => {
        const url = config.get<string>('database.poolUrl');
        if (!url) {
          throw new Error('DATABASE_POOL_URL (또는 DATABASE_URL) 환경변수가 필요합니다.');
        }

        cachedClient ??= postgres(url, {
          // Supabase 트랜잭션 풀러(Supavisor)는 prepared statement 미지원
          prepare: false,
          // Lambda 인스턴스당 커넥션 1개로 제한 — 풀러 고갈 방지
          max: 1,
          idle_timeout: 20,
          connect_timeout: 10,
        });

        return drizzle(cachedClient, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await cachedClient?.end({ timeout: 5 });
    cachedClient = undefined;
  }
}
