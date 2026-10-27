import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** JwtStrategy.validate() 가 request.user 에 넣어주는 페이로드 */
export interface AuthUser {
  userId: number;
}

/**
 * 컨트롤러에서 인증 사용자를 꺼냄
 * - `@CurrentUser() user: AuthUser`        전체
 * - `@CurrentUser('userId') id: number`    특정 필드
 * 옵셔널 인증 라우트에서는 비로그인 시 undefined 가 들어올 수 있음
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | number | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
