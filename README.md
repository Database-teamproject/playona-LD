# Playona Backend

음악 링크 하나로 여러 음악 플랫폼의 동일한 곡을 찾아 공유하는 Playona의 서버리스 백엔드입니다. 기존 Java Spring 백엔드의 API와 매칭 동작을 NestJS로 옮겼으며, AWS Lambda 컨테이너 이미지로 배포합니다.

## 서비스 주소

| 구분       | 주소                                                               |
| ---------- | ------------------------------------------------------------------ |
| Frontend   | https://playona-five.vercel.app                                    |
| Backend    | https://ofq37ku3ma.execute-api.ap-northeast-2.amazonaws.com        |
| Swagger UI | https://ofq37ku3ma.execute-api.ap-northeast-2.amazonaws.com/docs   |
| Health     | https://ofq37ku3ma.execute-api.ap-northeast-2.amazonaws.com/health |

`/health`는 애플리케이션 응답을 확인하는 엔드포인트이며, DB 연결 상태까지 검사하지는 않습니다.

## 주요 기능

- 음악 URL에서 곡 정보를 추출하고 다른 플랫폼의 곡과 매칭합니다.
- 짧은 공유 링크를 생성하고 플랫폼별 이동 URL과 클릭 수를 관리합니다.
- 비회원 링크 생성을 지원하고, 로그인한 사용자는 자신의 링크를 조회·삭제·재매칭할 수 있습니다.
- 카카오 OAuth 로그인과 JWT 인증, refresh token 회전·폐기를 지원합니다.
- 사용자 프로필과 음악 플랫폼 우선순위를 관리합니다.
- S3를 설정하면 프로필 이미지를 업로드할 수 있습니다.

구글 OAuth 코드는 남아 있지만 현재 프론트엔드에서는 구글 로그인 버튼을 표시하지 않습니다.

## 기술 구성

| 구분           | 기술                                                |
| -------------- | --------------------------------------------------- |
| Runtime        | Node.js 22, TypeScript                              |
| Framework      | NestJS 11, Express                                  |
| Database       | Supabase PostgreSQL, Drizzle ORM, postgres.js       |
| Authentication | OAuth 2.0, JWT, Passport                            |
| Deployment     | AWS SAM, Docker, Lambda ARM64, API Gateway HTTP API |
| Operations     | Amazon ECR, CloudWatch Logs, EventBridge Scheduler  |
| Validation     | Jest, ESLint, TypeScript, SAM template lint         |

```mermaid
flowchart LR
    Client[Client] <--> Frontend[Vercel / React / Vite]
    Frontend <--> Gateway
    subgraph AWS["AWS / ap-northeast-2"]
        Gateway[API Gateway HTTP API] <--> Backend[Lambda / NestJS]
        ECR[Amazon ECR] -. Image deployment .-> Backend
        Backend -. Application logs .-> Logs[CloudWatch Logs]
    end
    Backend <--> DB[Supabase PostgreSQL]
    Backend <--> Kakao[Kakao OAuth]
    Backend <--> Music[Music metadata APIs / Web retrieval]
```

### 음악 메타데이터 소스

| 플랫폼                  | 조회 방식                                    |
| ----------------------- | -------------------------------------------- |
| Spotify                 | Spotify Web API: 곡 조회, ISRC·텍스트 검색   |
| YouTube Music / YouTube | YouTube Data API v3: 영상 정보 조회, 곡 검색 |
| Apple Music             | iTunes Search API: 곡 ID 조회, 텍스트 검색   |
| FLO                     | FLO 웹 API: 곡 메타데이터 조회, 검색         |
| Genie                   | 곡 상세·검색 페이지 HTML 조회                |
| Melon                   | 곡 상세·검색 페이지 HTML 조회                |

외부 응답과 제목·아티스트·재생 시간 등의 근거를 검증해 매칭합니다. 외부 서비스의 권한, 응답, 페이지 구조에 따라 일부 결과가 없을 수 있습니다.

## 로컬 실행

Node.js 22와 PostgreSQL이 필요합니다. SAM 실행·배포에는 Docker, AWS CLI, AWS SAM CLI도 필요합니다.

```bash
npm ci
cp .env.example .env
```

`.env`에 개발용 DB 연결 문자열과 사용할 외부 API 자격증명을 설정합니다. 로컬 프론트엔드와 연결한다면 다음 주소도 개발 환경에 맞춰 변경합니다.

```dotenv
FRONTEND_URL=http://localhost:5173
SHARE_BASE_URL=http://localhost:5173
KAKAO_REDIRECT_URI=http://localhost:8080/api/auth/kakao/callback
```

`FRONTEND_URL`은 CORS 허용 출처와 OAuth 로그인 후 이동 주소로 사용합니다. 카카오 개발자 콘솔에도 같은 앱의 REST API 키에 해당 callback URI를 등록해야 합니다. 클라이언트 시크릿이 활성화되어 있다면 해당 앱의 **카카오 로그인용** 시크릿을 설정합니다.

새 개발 DB에 마이그레이션과 플랫폼 초기 데이터를 적용한 뒤 서버를 실행합니다. CLI에서 `.env`를 읽도록 `--env-file`을 명시합니다.

```bash
node --env-file=.env node_modules/drizzle-kit/bin.cjs migrate
npm run db:seed
npm run start:dev
```

- API: http://localhost:8080
- Swagger: http://localhost:8080/docs
- 기본 포트: `8080` (`PORT`로 변경)

## 환경변수

값의 형식과 전체 목록은 [.env.example](.env.example)을 참고합니다. 실제 키·비밀번호·토큰은 `.env`에만 저장합니다.

| 변수                                                              | 용도                                                            |
| ----------------------------------------------------------------- | --------------------------------------------------------------- |
| `NODE_ENV`, `PORT`                                                | 실행 환경과 로컬 포트                                           |
| `DATABASE_URL`                                                    | 마이그레이션·시드용 DB 연결 문자열                              |
| `DATABASE_POOL_URL`                                               | 애플리케이션용 연결 문자열. 없으면 `DATABASE_URL` 사용          |
| `JWT_SECRET`                                                      | JWT 서명 키. 프로덕션에서는 32자 이상 필수                      |
| `JWT_ACCESS_EXPIRATION`                                           | 로컬 access token 유효 기간(초), 기본 `3600`                    |
| `JWT_REFRESH_EXPIRATION`                                          | 로컬 refresh token 유효 기간(초), 기본 `1209600`                |
| `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`    | 카카오 OAuth 설정                                               |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | 구글 OAuth 설정. 현재 프론트엔드에서는 사용하지 않음            |
| `FRONTEND_URL`                                                    | CORS 허용 origin 및 OAuth 결과 전달 대상                        |
| `SHARE_BASE_URL`                                                  | 공유 링크의 프론트엔드 기준 주소                                |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`                      | Spotify Client Credentials 인증                                 |
| `YOUTUBE_API_KEY`                                                 | YouTube Data API v3 키                                          |
| `S3_BUCKET`, `S3_REGION`, `S3_PUBLIC_BASE_URL`                    | 선택 사항: 프로필 이미지 저장소와 공개 URL                      |
| `AI_MATCHING_MODE`                                                | 선택 사항: `off`(기본), `shadow`, `assist`                      |
| `OPENAI_API_KEY`, `AI_MATCHING_MODEL`                             | AI 매칭을 활성화할 때 사용                                      |
| `AI_MATCHING_MAX_REQUESTS`                                        | warm Lambda 인스턴스별 AI 요청 한도, 기본 `20`. `0`은 제한 없음 |

Lambda에서는 Supabase의 트랜잭션 풀러 연결 문자열을 사용합니다. 클라이언트는 `prepare: false`, 인스턴스당 최대 연결 수 `1`로 설정되어 있습니다. `DATABASE_URL`에는 개발 환경에서 접근 가능한 마이그레이션용 연결 문자열을 사용합니다.

SAM 배포 시 JWT 만료 시간은 [template.yaml](template.yaml)의 값이 적용됩니다. `.env`의 만료 시간만 바꿔서는 운영 설정이 바뀌지 않습니다.

## API

상세 요청·응답 스키마는 Swagger UI를 확인합니다. 인증이 필요한 API는 다음 헤더를 사용합니다.

```http
Authorization: Bearer <access-token>
```

| Method     | Path                              | 설명                              | 인증             |
| ---------- | --------------------------------- | --------------------------------- | ---------------- |
| GET        | `/health`                         | 애플리케이션 상태                 | 공개             |
| GET        | `/api/auth/kakao`                 | 카카오 로그인 시작                | 공개             |
| GET        | `/api/auth/kakao/callback`        | 카카오 인증 callback              | OAuth state 검증 |
| POST       | `/api/auth/refresh`               | refresh token 회전 및 토큰 재발급 | refresh token    |
| POST       | `/api/auth/logout`                | refresh token 폐기                | JWT              |
| GET / PUT  | `/api/users/me`                   | 내 프로필 조회·수정               | JWT              |
| POST       | `/api/users/me/profile-image`     | 프로필 이미지 업로드              | JWT              |
| GET / PUT  | `/api/users/me/platforms`         | 플랫폼 선호 순서 조회·변경        | JWT              |
| GET        | `/api/platforms`                  | 활성 플랫폼 목록                  | 공개             |
| GET / POST | `/api/tracks/resolve`             | URL로 곡 정보 조회·매칭           | 공개             |
| GET        | `/api/tracks/:trackUuid`          | 저장된 곡 조회                    | 공개             |
| POST       | `/api/links`                      | 공유 링크 생성                    | 선택             |
| GET        | `/api/links/my`                   | 내가 생성한 링크 조회             | JWT              |
| GET        | `/api/links/:shortCode`           | 공유 링크 조회                    | 공개             |
| GET        | `/api/links/:shortCode/platforms` | 플랫폼별 URL 조회                 | 공개             |
| GET        | `/api/links/:shortCode/redirect`  | 이동 URL 조회 및 클릭 집계        | 선택             |
| DELETE     | `/api/links/:shortCode`           | 내 링크 삭제                      | 소유자 JWT       |
| POST       | `/api/links/:shortCode/rematch`   | 내 링크 재매칭                    | 소유자 JWT       |

`GET /api/tracks/resolve`는 `url` 쿼리를, POST 버전과 링크 생성은 `{ "url": "..." }` 본문을 받습니다. 링크의 `redirect` 엔드포인트는 HTTP 리디렉션 대신 JSON을 반환하며, 프론트엔드가 실제 이동을 처리합니다.

OAuth 시작 경로는 `/oauth2/authorization/kakao`도 지원합니다. state 쿠키가 callback 도메인과 일치하도록 로그인은 백엔드 주소로 직접 시작합니다. 성공 시 `/auth/success`로 토큰을 전달하고, 실패 시 같은 경로에 `error` 쿼리를 전달합니다.

일반 API 응답 형식:

```json
{
  "success": true,
  "data": {}
}
```

오류 응답은 `success: false`, `data: null`, `status`, `message`, `timestamp`를 포함합니다.

## 데이터베이스 변경

스키마는 [src/database/schema.ts](src/database/schema.ts), 버전별 마이그레이션은 [drizzle/](drizzle/)에서 관리합니다.

```bash
# 스키마 수정 후 마이그레이션 생성
npm run db:generate

# 대상 DB에 적용 (.env의 DATABASE_URL 사용)
node --env-file=.env node_modules/drizzle-kit/bin.cjs migrate

# 초기 플랫폼 데이터 추가 (기존 행은 유지)
npm run db:seed
```

Lambda 이미지에는 마이그레이션 파일과 개발 CLI가 포함되지 않으며, 서버 시작 시 마이그레이션을 자동 실행하지 않습니다. 코드 배포 전에 대상 DB에 필요한 마이그레이션을 별도로 적용합니다. 운영 DB 변경에는 버전 관리되는 마이그레이션을 사용합니다.

## 서버리스 배포

AWS 자격증명과 실행 중인 Docker가 필요합니다. 기본 스택은 `playona-be`, 리전은 `ap-northeast-2`입니다.

```bash
# .env에서 배포 파라미터 파일 생성
npm run sam:prepare-deploy

# ARM64 컨테이너 이미지 빌드
npm run sam:build

# CloudFormation / ECR / Lambda / HTTP API 배포
sam deploy --config-file samconfig.local.toml --no-fail-on-empty-changeset
```

배포 준비 스크립트는 DB 연결과 32자 이상의 JWT 키를 확인합니다. `FRONTEND_URL`, `SHARE_BASE_URL`, 두 OAuth callback URI는 운영 HTTPS 주소여야 합니다. 현재 스크립트는 구글 로그인 버튼 사용 여부와 관계없이 `GOOGLE_REDIRECT_URI`도 검사합니다.

`.env`, `env.json`, `samconfig.local.toml`은 비밀 값이 포함될 수 있어 Git에서 제외됩니다. `SAM_STACK_NAME`, `AWS_REGION`으로 배포 준비 스크립트의 기본 스택·리전을 변경할 수 있습니다.

API Gateway의 CORS는 `FRONTEND_URL`을 허용하며, 인증 요청에 필요한 `Authorization`, `Content-Type`, `Accept` 헤더를 명시합니다. 운영 도메인을 변경할 때 프론트엔드 주소, OAuth callback, CORS 설정을 함께 확인합니다.

### SAM 로컬 실행

```bash
npm run sam:env
npm run sam:build
npm run sam:local
```

기본 API 주소는 `http://127.0.0.1:3000`입니다. `.env`의 DB 주소는 Docker 컨테이너에서도 접근 가능해야 합니다. 호스트 PC의 DB를 사용하는 경우 해당 개발 환경에서 `host.docker.internal` 등의 주소를 설정합니다.

### GitHub Actions

[deploy.yml](.github/workflows/deploy.yml)은 push·PR에서 lint, typecheck, 테스트, 빌드, SAM 검증을 실행합니다. 통합 테스트에는 별도의 PostgreSQL 서비스 컨테이너를 사용합니다.

자동 배포는 `main` 브랜치에서 저장소 변수 `AWS_DEPLOY_ENABLED=true`인 경우에만 실행됩니다. AWS OIDC 역할 ARN을 `AWS_ROLE_ARN` secret에 등록하고, 워크플로에 선언된 DB·JWT·OAuth·음악 API secrets를 설정해야 합니다. 이 조건이 충족되지 않으면 CI만 실행하고 배포 단계는 건너뜁니다. 워크플로는 DB 마이그레이션을 자동 적용하지 않습니다.

## 검증

```bash
npm run lint
npm run typecheck
npm run test:ci
npm run build
sam validate --lint
```

DB 통합 테스트는 `TEST_DATABASE_URL`이 없으면 건너뜁니다. 호스트가 `localhost` 또는 `127.0.0.1`이고 DB 이름이 `playona_test`인 테스트 전용 PostgreSQL DB를 준비하면 다음 명령으로 함께 실행할 수 있습니다.

```bash
TEST_DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/playona_test npm run test:ci
```

운영 DB 대신 테스트 전용 DB를 지정합니다. 통합 테스트는 테스트 데이터를 초기화합니다.

## 운영 메모

- API Lambda는 ARM64, 메모리 512 MB, timeout 30초로 설정되어 있습니다.
- EventBridge Scheduler가 매일 한국 시간 03:00에 별도 DB 유지용 Lambda를 호출합니다. 이 함수는 NestJS를 시작하지 않고 `select id from public.platforms limit 1`을 실행합니다. 설정은 128 MB, timeout 15초, 재시도 0회이며 로그 보존 기간은 7일입니다. 이 작업이 Supabase의 자동 일시정지 방지를 보장하지는 않습니다.
- 프로필 이미지 업로드는 기존 S3 버킷을 설정해야 합니다. SAM은 버킷을 생성하거나 공개 읽기 정책을 설정하지 않으며, 지정한 버킷의 `profile-images/*`에 쓰기 권한을 부여합니다.
- AI 매칭은 기본 `off`입니다. 활성화하면 별도의 외부 API 사용료가 발생할 수 있으며, 요청 한도는 전체 서비스가 아닌 인스턴스 단위입니다.
- Lambda 무료 사용량과 별개로 API Gateway, ECR 저장소, 로그, S3 등의 비용이 발생할 수 있습니다.

## 디렉터리

```text
src/
  auth/          OAuth, JWT, refresh token
  users/         프로필, 플랫폼 우선순위, 이미지 업로드
  platforms/     활성 플랫폼 목록
  tracks/        URL 분석, 메타데이터 조회, 플랫폼 매칭
  links/         공유 링크, 소유권, 클릭 집계
  database/      Drizzle 스키마, 연결, 시드, DB 유지 함수
  common/        인증 데코레이터, 공통 응답, 오류 처리
  config/        환경변수 매핑
  main.ts        로컬 서버 진입점
  lambda.ts      Lambda API 핸들러
  setup.ts       CORS, 검증, Swagger 설정
drizzle/         DB 마이그레이션
scripts/         SAM 환경·배포 파라미터 생성
template.yaml    AWS SAM 인프라 정의
Dockerfile       Lambda 컨테이너 빌드
```
