import { chmodSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const deploy = process.argv.includes('--deploy');
const envFile = process.argv.find((arg) => arg.startsWith('--env-file='))?.slice(11) ?? '.env';
process.loadEnvFile(resolve(envFile));
const value = (key, fallback = '') => process.env[key]?.trim() || fallback;
const mapping = {
  DatabaseUrl: 'DATABASE_POOL_URL',
  JwtSecret: 'JWT_SECRET',
  KakaoClientId: 'KAKAO_CLIENT_ID',
  KakaoClientSecret: 'KAKAO_CLIENT_SECRET',
  KakaoRedirectUri: 'KAKAO_REDIRECT_URI',
  GoogleClientId: 'GOOGLE_CLIENT_ID',
  GoogleClientSecret: 'GOOGLE_CLIENT_SECRET',
  GoogleRedirectUri: 'GOOGLE_REDIRECT_URI',
  ShareBaseUrl: 'SHARE_BASE_URL',
  FrontendUrl: 'FRONTEND_URL',
  SpotifyClientId: 'SPOTIFY_CLIENT_ID',
  SpotifyClientSecret: 'SPOTIFY_CLIENT_SECRET',
  YoutubeApiKey: 'YOUTUBE_API_KEY',
  ProfileImageBucket: 'S3_BUCKET',
  ProfileImagePublicBaseUrl: 'S3_PUBLIC_BASE_URL',
  AiMatchingMode: 'AI_MATCHING_MODE',
  OpenAiApiKey: 'OPENAI_API_KEY',
  AiMatchingModel: 'AI_MATCHING_MODEL',
  AiMatchingMaxRequests: 'AI_MATCHING_MAX_REQUESTS',
};
const env = Object.fromEntries(Object.values(mapping).map((key) => [key, value(key)]));
env.DATABASE_POOL_URL ||= value('DATABASE_URL');
env.JWT_ACCESS_EXPIRATION = value('JWT_ACCESS_EXPIRATION', '3600');
env.JWT_REFRESH_EXPIRATION = value('JWT_REFRESH_EXPIRATION', '1209600');
env.AI_MATCHING_MODE ||= 'off';
env.AI_MATCHING_MODEL ||= 'gpt-4o-mini';
env.AI_MATCHING_MAX_REQUESTS ||= '20';
env.NODE_ENV = deploy ? 'production' : 'development';
if (!env.DATABASE_POOL_URL || env.JWT_SECRET.length < 32)
  throw new Error('DATABASE_POOL_URL and a 32+ character JWT_SECRET are required');
if (deploy) {
  for (const key of [
    'KAKAO_REDIRECT_URI',
    'GOOGLE_REDIRECT_URI',
    'FRONTEND_URL',
    'SHARE_BASE_URL',
  ]) {
    let url;
    try {
      url = new URL(env[key]);
    } catch {
      throw new Error(`${key}: a production HTTPS URL is required`);
    }
    if (url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname))
      throw new Error(`${key}: a production HTTPS URL is required`);
  }
  const params = [
    'Stage=prod',
    ...Object.entries(mapping)
      .filter(([, key]) => env[key] !== '')
      .map(([parameter, key]) => `${parameter}=${env[key]}`),
  ];
  const config = [
    'version = 0.1',
    '[default.deploy.parameters]',
    `stack_name = ${JSON.stringify(value('SAM_STACK_NAME', 'playona-be'))}`,
    `region = ${JSON.stringify(value('AWS_REGION', 'ap-northeast-2'))}`,
    'capabilities = "CAPABILITY_IAM"',
    'resolve_s3 = true',
    'resolve_image_repos = true',
    'confirm_changeset = false',
    `parameter_overrides = ${JSON.stringify(params)}`,
    '',
  ].join('\n');
  writeFileSync('samconfig.local.toml', config, { mode: 0o600 });
  chmodSync('samconfig.local.toml', 0o600);
  console.log(
    'Prepared private samconfig.local.toml. Deploy with: sam deploy --config-file samconfig.local.toml',
  );
} else {
  writeFileSync('env.json', JSON.stringify({ ApiFunction: env }, null, 2) + '\n', { mode: 0o600 });
  chmodSync('env.json', 0o600);
  console.log('Prepared private env.json for sam local.');
}
