import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../common/decorators/current-user.decorator';

interface JwtPayload {
  sub: string; // userId
  type: 'access' | 'refresh';
}

/**
 * Authorization: Bearer <access token> 검증
 * 원본 Spring 의 JwtAuthenticationFilter + JwtProvider 역할
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') ?? '',
    });
  }

  validate(payload: JwtPayload): AuthUser {
    // access token 만 API 인증에 사용 (refresh token 으로 API 호출 차단)
    if (
      payload.type !== 'access' ||
      !Number.isSafeInteger(Number(payload.sub)) ||
      Number(payload.sub) < 1
    ) {
      throw new UnauthorizedException('유효하지 않은 토큰 유형입니다');
    }
    return { userId: Number(payload.sub) };
  }
}
