import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthProfile } from '../dto/auth.dto';

/**
 * 카카오·구글 OAuth 인가 코드를 사용자 프로필로 교환함
 * 인가 코드 → access token → 사용자 정보 조회 순
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(private readonly config: ConfigService) {}

  /** 카카오 인증 페이지 URL (사용자를 여기로 리디렉션) */
  getKakaoAuthUrl(state: string): string {
    const { clientId, redirectUri } = this.config.get('oauth.kakao')!;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });
    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  }

  /** 구글 인증 페이지 URL */
  getGoogleAuthUrl(state: string): string {
    const { clientId, redirectUri } = this.config.get('oauth.google')!;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      scope: 'openid email profile',
      access_type: 'offline',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /** 카카오 인가 코드 → 프로필 */
  async getKakaoProfile(code: string): Promise<OAuthProfile> {
    const { clientId, clientSecret, redirectUri } = this.config.get('oauth.kakao')!;

    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      signal: AbortSignal.timeout(8_000),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });
    const accessToken = await this.extractAccessToken(tokenRes, 'kakao');

    const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      signal: AbortSignal.timeout(8_000),
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      throw new UnauthorizedException('카카오 사용자 정보 조회에 실패했습니다');
    }
    const data = (await userRes.json()) as {
      id: number;
      kakao_account?: {
        email?: string;
        profile?: { nickname?: string; profile_image_url?: string };
      };
    };

    const account = data.kakao_account;
    return {
      provider: 'kakao',
      providerId: String(data.id),
      email: account?.email ?? `kakao_${data.id}@playona.local`,
      nickname: account?.profile?.nickname ?? '카카오 사용자',
      profileImageUrl: account?.profile?.profile_image_url ?? null,
    };
  }

  /** 구글 인가 코드 → 프로필 */
  async getGoogleProfile(code: string): Promise<OAuthProfile> {
    const { clientId, clientSecret, redirectUri } = this.config.get('oauth.google')!;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      signal: AbortSignal.timeout(8_000),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });
    const accessToken = await this.extractAccessToken(tokenRes, 'google');

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      signal: AbortSignal.timeout(8_000),
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      throw new UnauthorizedException('구글 사용자 정보 조회에 실패했습니다');
    }
    const data = (await userRes.json()) as {
      id: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    return {
      provider: 'google',
      providerId: data.id,
      email: data.email ?? `google_${data.id}@playona.local`,
      nickname: data.name ?? '구글 사용자',
      profileImageUrl: data.picture ?? null,
    };
  }

  private async extractAccessToken(res: Response, provider: string): Promise<string> {
    if (!res.ok) {
      this.logger.warn(`${provider} 토큰 교환 실패: ${res.status}`);
      throw new UnauthorizedException(`${provider} 인증에 실패했습니다`);
    }
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) {
      throw new UnauthorizedException(`${provider} 액세스 토큰을 받지 못했습니다`);
    }
    return json.access_token;
  }
}
