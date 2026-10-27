import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** 전역 JwtAuthGuard 를 건너뛰는 라우트 표시 (인증 불필요) */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
