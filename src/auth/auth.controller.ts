import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { RefreshTokenDto, TokenResponseDto } from './dto/auth.dto';

/**
 * 서버 주도(server-side) OAuth 흐름
 * 1. 사용자 → GET /api/auth/{provider}        → 제공자 인증 페이지로 리디렉션
 * 2. 제공자 → GET /api/auth/{provider}/callback → 인가 코드 수신, JWT 발급
 * 3. 백엔드 → 프론트엔드 /auth/success?accessToken=...&refreshToken=... 로 리디렉션
 */
@ApiTags('Auth')
@Controller(['api/auth', 'oauth2/authorization'])
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('kakao')
  @ApiOperation({
    summary: 'Start Kakao login',
    description: 'Redirects the user to the Kakao authorization page.',
  })
  @ApiResponse({ status: 302, description: 'Redirects to the Kakao authorization page.' })
  kakaoLogin(@Res() res: Response): void {
    res.redirect(this.authService.getKakaoAuthUrl(this.startState(res, 'kakao')));
  }

  @Public()
  @Get('kakao/callback')
  @ApiExcludeEndpoint() // 브라우저 리디렉션 전용 — 직접 호출 대상 아님
  async kakaoCallback(
    @Res() res: Response,
    @Req() req: Request,
    @Query('state') state?: string,
    @Query('code') code?: string,
    @Query('error') error?: string,
  ): Promise<void> {
    await this.completeLogin(
      res,
      this.validateState(req, res, 'kakao', state) ? error : 'invalid_state',
      () => this.authService.loginWithKakao(code ?? ''),
    );
  }

  @Public()
  @Get('google')
  @ApiOperation({
    summary: 'Start Google login',
    description: 'Redirects the user to the Google authorization page.',
  })
  @ApiResponse({ status: 302, description: 'Redirects to the Google authorization page.' })
  googleLogin(@Res() res: Response): void {
    res.redirect(this.authService.getGoogleAuthUrl(this.startState(res, 'google')));
  }

  @Public()
  @Get('google/callback')
  @ApiExcludeEndpoint()
  async googleCallback(
    @Res() res: Response,
    @Req() req: Request,
    @Query('state') state?: string,
    @Query('code') code?: string,
    @Query('error') error?: string,
  ): Promise<void> {
    await this.completeLogin(
      res,
      this.validateState(req, res, 'google', state) ? error : 'invalid_state',
      () => this.authService.loginWithGoogle(code ?? ''),
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh tokens',
    description: 'Issues a new access token using a refresh token.',
  })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary: 'Logout',
    description: 'Revokes the provided refresh token.',
  })
  async logout(@Body() dto: RefreshTokenDto): Promise<{ message: string }> {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Logged out successfully.' };
  }

  /**
   * OAuth 콜백 공통 처리 — 토큰을 쿼리에 실어 프론트엔드로 리디렉션함
   * 실패 시 ?error= 를 붙여 보내고, 프론트의 /auth/success 가 이를 처리함
   */
  private async completeLogin(
    res: Response,
    error: string | undefined,
    login: () => Promise<TokenResponseDto>,
  ): Promise<void> {
    const frontend = this.config.get<string>('frontendUrl');

    if (error) {
      res.redirect(`${frontend}/auth/success?error=${encodeURIComponent(error)}`);
      return;
    }

    try {
      const token = await login();
      const params = new URLSearchParams({
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresIn: String(token.expiresIn),
      });
      res.redirect(`${frontend}/auth/success?${params.toString()}`);
    } catch {
      res.redirect(`${frontend}/auth/success?error=oauth_failed`);
    }
  }

  private startState(res: Response, provider: string): string {
    const state = randomBytes(32).toString('hex');
    res.cookie(`playona_oauth_${provider}`, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('nodeEnv') === 'production',
      maxAge: 600_000,
      path: `/api/auth/${provider}/callback`,
    });
    return state;
  }

  private validateState(req: Request, res: Response, provider: string, state?: string): boolean {
    const key = `playona_oauth_${provider}`;
    const cookie = (req.headers.cookie ?? '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${key}=`))
      ?.slice(key.length + 1);
    res.clearCookie(key, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('nodeEnv') === 'production',
      path: `/api/auth/${provider}/callback`,
    });
    return Boolean(
      state &&
      cookie &&
      /^[a-f0-9]{64}$/.test(state) &&
      cookie.length === state.length &&
      timingSafeEqual(Buffer.from(cookie), Buffer.from(state)),
    );
  }
}
