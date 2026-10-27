/**
 * 환경변수 → 타입 안전한 설정 객체로 매핑
 * ConfigModule.forRoot({ load: [configuration] }) 로 등록함
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  database: {
    url: string;
    poolUrl: string;
  };
  jwt: {
    secret: string;
    accessExpiration: number; // 초 단위
    refreshExpiration: number; // 초 단위
  };
  oauth: {
    kakao: { clientId: string; clientSecret: string; redirectUri: string };
    google: { clientId: string; clientSecret: string; redirectUri: string };
  };
  shareBaseUrl: string;
  /** OAuth 성공 후 토큰을 실어 리디렉션할 프론트엔드 주소 */
  frontendUrl: string;
  /** 트랙 메타데이터 수집용 외부 API 자격증명 */
  track: {
    spotify: { clientId: string; clientSecret: string };
    youtube: { apiKey: string };
  };
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) {
    throw new Error('프로덕션 JWT_SECRET은 32자 이상이어야 합니다');
  }
  return secret || 'local-dev-secret-key-must-be-at-least-32-chars';
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '8080', 10),
  database: {
    // 마이그레이션·로컬용 다이렉트 커넥션
    url: process.env.DATABASE_URL ?? '',
    // Lambda 런타임용 트랜잭션 풀러 미설정 시 url 로 폴백
    poolUrl: process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL ?? '',
  },
  jwt: {
    secret: jwtSecret(),
    accessExpiration: parseInt(process.env.JWT_ACCESS_EXPIRATION ?? '3600', 10),
    refreshExpiration: parseInt(process.env.JWT_REFRESH_EXPIRATION ?? '1209600', 10),
  },
  oauth: {
    kakao: {
      clientId: process.env.KAKAO_CLIENT_ID ?? '',
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? '',
      redirectUri: process.env.KAKAO_REDIRECT_URI ?? '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI ?? '',
    },
  },
  shareBaseUrl: (process.env.SHARE_BASE_URL || 'https://playona-five.vercel.app').replace(
    /\/+$/,
    '',
  ),
  frontendUrl: (process.env.FRONTEND_URL || 'https://playona-five.vercel.app').replace(/\/+$/, ''),
  track: {
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID ?? '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? '',
    },
    youtube: {
      apiKey: process.env.YOUTUBE_API_KEY ?? '',
    },
  },
});
