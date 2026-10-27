import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, DrizzleDB } from '../database/database.module';
import { users } from '../database/schema';
import { OAuthProfile, TokenResponseDto } from './dto/auth.dto';
import { OAuthService } from './oauth/oauth.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly oauth: OAuthService,
    private readonly tokenService: TokenService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  /** 카카오 인증 페이지 URL */
  getKakaoAuthUrl(state: string): string {
    return this.oauth.getKakaoAuthUrl(state);
  }

  /** 구글 인증 페이지 URL */
  getGoogleAuthUrl(state: string): string {
    return this.oauth.getGoogleAuthUrl(state);
  }

  async loginWithKakao(code: string): Promise<TokenResponseDto> {
    const profile = await this.oauth.getKakaoProfile(code);
    return this.loginWithProfile(profile);
  }

  async loginWithGoogle(code: string): Promise<TokenResponseDto> {
    const profile = await this.oauth.getGoogleProfile(code);
    return this.loginWithProfile(profile);
  }

  async refresh(refreshToken: string): Promise<TokenResponseDto> {
    return this.tokenService.rotate(refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokenService.revoke(refreshToken);
  }

  /** OAuth 프로필로 회원을 찾거나 만든 뒤(upsert) 토큰을 발급함 */
  private async loginWithProfile(profile: OAuthProfile): Promise<TokenResponseDto> {
    const userId = await this.upsertUser(profile);
    return this.tokenService.issueTokens(userId);
  }

  private async upsertUser(profile: OAuthProfile): Promise<number> {
    const values = {
      email: profile.email,
      nickname: profile.nickname,
      profileImageUrl: profile.profileImageUrl,
      provider: profile.provider,
      providerId: profile.providerId,
    };
    const [user] = await this.db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: [users.provider, users.providerId],
        set: {
          email: profile.email,
          nickname: profile.nickname,
          profileImageUrl: profile.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning({ id: users.id });
    return user.id;
  }
}
