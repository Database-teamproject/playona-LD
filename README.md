# Playona Backend

음악 링크 하나로 여러 음악 플랫폼의 동일한 곡을 찾아 공유하는 Playona의 서버리스 백엔드입니다.

기존 Java Spring 백엔드의 주요 기능을 NestJS로 옮겼으며 AWS Lambda에서 실행됩니다.

## 서비스

| 구분     | 주소                                                             |
| -------- | ---------------------------------------------------------------- |
| Frontend | https://playona-five.vercel.app                                  |
| Backend  | https://ofq37ku3ma.execute-api.ap-northeast-2.amazonaws.com      |
| API 문서 | https://ofq37ku3ma.execute-api.ap-northeast-2.amazonaws.com/docs |

## 주요 기능

- 음악 URL 분석과 플랫폼 간 곡 매칭
- 짧은 통합 공유 링크 생성 및 클릭 집계
- 카카오 OAuth 로그인과 JWT 인증
- 로그인 토큰 갱신 및 로그아웃 시 refresh token 무효화
- 사용자 프로필과 음악 플랫폼 우선순위 관리
- 회원별 링크 조회·삭제·재매칭

## 기술 구성

| 구분           | 기술                                 |
| -------------- | ------------------------------------ |
| Backend        | Node.js 22, TypeScript, NestJS 11    |
| Database       | Supabase PostgreSQL, Drizzle ORM     |
| Authentication | Kakao OAuth 2.0, JWT, Passport       |
| Deployment     | Docker, AWS SAM, Lambda, API Gateway |
| Operations     | Amazon ECR, CloudWatch Logs          |

<img width="1672" height="941" alt="playona-architecture-2026-10-29-v4-en" src="https://github.com/user-attachments/assets/475f1fe1-bd80-405f-be4c-5486ef0532a1" />

Spotify Web API, YouTube Data API, iTunes Search API, FLO 웹 API를 사용합니다.

Genie와 Melon은 공개 웹 페이지에서 곡 정보를 조회합니다.

## 로컬 실행

Node.js 22와 PostgreSQL이 필요합니다.

```bash
npm ci
cp .env.example .env
```

`.env`에 DB, JWT, 카카오 OAuth, 음악 API 정보를 설정한 다음 마이그레이션과 초기 데이터를 적용합니다.

```bash
node --env-file=.env node_modules/drizzle-kit/bin.cjs migrate
npm run db:seed
npm run start:dev
```

- API: http://localhost:8080
- Swagger UI: http://localhost:8080/docs

로컬 프론트엔드와 연결할 때는 다음 주소를 사용합니다.

```dotenv
FRONTEND_URL=http://localhost:5173
SHARE_BASE_URL=http://localhost:5173
KAKAO_REDIRECT_URI=http://localhost:8080/api/auth/kakao/callback
```

## 환경변수

전체 목록은 [.env.example](.env.example)을 참고합니다.

| 변수                                                           | 용도                                        |
| -------------------------------------------------------------- | ------------------------------------------- |
| `DATABASE_URL`                                                 | 마이그레이션·시드용 DB 연결 문자열          |
| `DATABASE_POOL_URL`                                            | 애플리케이션용 DB 연결 문자열               |
| `JWT_SECRET`                                                   | JWT 서명 키. 운영 환경에서는 32자 이상 필수 |
| `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI` | 카카오 OAuth 설정                           |
| `FRONTEND_URL`, `SHARE_BASE_URL`                               | 프론트엔드와 공유 링크 기준 주소            |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`                   | Spotify API 인증                            |
| `YOUTUBE_API_KEY`                                              | YouTube Data API 키                         |
| `S3_BUCKET`, `S3_PUBLIC_BASE_URL`                              | 프로필 이미지 저장소 (선택 사항)             |
| `AI_MATCHING_MODE`, `OPENAI_API_KEY`                           | AI 기반 매칭 보조 (선택 사항)                |

## API

상세 요청과 응답은 Swagger UI에서 확인할 수 있습니다.

| 영역      | 주요 경로         |
| --------- | ----------------- |
| 인증      | `/api/auth/*`     |
| 사용자    | `/api/users/me/*` |
| 플랫폼    | `/api/platforms`  |
| 곡 조회   | `/api/tracks/*`   |
| 공유 링크 | `/api/links/*`    |
| 상태 확인 | `/health`         |

## 데이터베이스

스키마는 [src/database/schema.ts](src/database/schema.ts), 마이그레이션은 [drizzle/](drizzle/)에서 관리합니다.

```bash
npm run db:generate
node --env-file=.env node_modules/drizzle-kit/bin.cjs migrate
npm run db:seed
```

## 배포

Docker, AWS CLI, AWS SAM CLI와 AWS 자격증명이 필요합니다.

```bash
npm run sam:prepare-deploy
npm run sam:build
sam deploy --config-file samconfig.local.toml --no-fail-on-empty-changeset
```

배포 설정은 [template.yaml](template.yaml)에 있습니다.

## 검증

```bash
npm run lint
npm run typecheck
npm run test:ci
npm run build
sam validate --lint
```

## 디렉터리

```text
src/auth/       OAuth와 JWT 인증
src/users/      사용자 프로필과 플랫폼 설정
src/platforms/  지원 플랫폼 목록
src/tracks/     음악 정보 조회와 매칭
src/links/      공유 링크 관리
src/database/   DB 스키마, 연결, 시드
drizzle/        DB 마이그레이션
template.yaml   AWS SAM 인프라 설정
```
