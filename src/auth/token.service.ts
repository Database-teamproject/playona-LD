import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DRIZZLE, DrizzleDB } from '../database/database.module';
import { refreshTokens } from '../database/schema';
import { TokenResponseDto } from './dto/auth.dto';

/**
 * JWT 발급·검증 및 refresh token 영속화
 * 원본 Spring 의 JwtProvider 역할 + refresh token DB 저장(로그아웃/재발급 지원)
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  /** access + refresh 토큰을 발급하고 refresh 는 DB에 저장함 */
  async issueTokens(userId: number): Promise<TokenResponseDto> {
    const accessExp = this.config.get<number>('jwt.accessExpiration')!;
    const refreshExp = this.config.get<number>('jwt.refreshExpiration')!;

    const accessToken = this.jwt.sign(
      { sub: String(userId), type: 'access' },
      { expiresIn: accessExp },
    );
    const refreshToken = this.jwt.sign(
      { sub: String(userId), type: 'refresh', jti: randomUUID() },
      { expiresIn: refreshExp },
    );

    await this.db.insert(refreshTokens).values({
      userId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + refreshExp * 1000),
    });

    return { accessToken, refreshToken, expiresIn: accessExp };
  }

  /** refresh token 검증 → 기존 토큰 폐기 후 새 토큰 세트 발급 (회전) */
  async rotate(refreshToken: string): Promise<TokenResponseDto> {
    const payload = this.verifyRefresh(refreshToken);

    return this.db.transaction(async (tx) => {
      const [stored] = await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.token, refreshToken),
            isNull(refreshTokens.revokedAt),
            gt(refreshTokens.expiresAt, new Date()),
            eq(refreshTokens.userId, Number(payload.sub)),
          ),
        )
        .returning();
      if (!stored) throw new UnauthorizedException('유효하지 않거나 폐기된 Refresh Token 입니다');
      return new TokenService(this.jwt, this.config, tx as unknown as DrizzleDB).issueTokens(
        stored.userId,
      );
    });
  }

  /** refresh token 폐기 (로그아웃) */
  async revoke(refreshToken: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.token, refreshToken));
  }

  private verifyRefresh(token: string): { sub: string; type: string } {
    try {
      const payload = this.jwt.verify<{ sub: string; type: string }>(token);
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Refresh Token 이 아닙니다');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Refresh Token 이 만료되었거나 유효하지 않습니다');
    }
  }
}
