import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class OAuthLoginDto {
  @ApiProperty({ description: 'OAuth 인가 코드', example: 'abc123xyz' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh Token', example: 'eyJhbGci...' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class TokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiJ9...' })
  refreshToken!: string;

  @ApiProperty({ description: 'Access Token 만료까지 남은 초', example: 3600 })
  expiresIn!: number;
}

/** OAuth 제공자에서 정규화한 사용자 프로필 */
export interface OAuthProfile {
  provider: 'kakao' | 'google';
  providerId: string;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
}
