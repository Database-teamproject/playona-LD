import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * 옵셔널 인증 가드 — openapi.yaml 에서 `security: [bearerAuth, {}]` 인 라우트용
 * 토큰이 있으면 검증해 request.user 를 채우고, 없거나 틀려도 401 을 던지지 않음
 *
 * 사용: 라우트에 @Public() + @UseGuards(OptionalJwtAuthGuard) 를 함께 붙임
 * (@Public() 으로 전역 JwtAuthGuard 를 끄고, 이 가드가 옵셔널 처리)
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // 토큰 없음/만료/위조 → 비로그인으로 처리
    }
    return true;
  }

  handleRequest<TUser>(_err: unknown, user: TUser): TUser {
    return user; // 실패해도 throw 하지 않음
  }
}
