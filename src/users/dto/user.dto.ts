import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUrl, Min, ValidateNested } from 'class-validator';

export class UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716' })
  userUuid!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: '윤성' })
  nickname!: string;

  @ApiPropertyOptional({ example: 'https://k.kakaocdn.net/...' })
  profileImageUrl!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: '윤성' })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional({ example: 'https://...' })
  @IsOptional()
  @IsUrl()
  profileImageUrl?: string;
}

export class PlatformPreferenceResponseDto {
  @ApiProperty({ example: 1 })
  platformId!: number;

  @ApiProperty({ example: 'Spotify' })
  platformName!: string;

  @ApiProperty({ example: 1 })
  priority!: number;
}

export class PlatformPreferenceItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  platformId!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  priority!: number;
}

export class UpdatePlatformPreferencesDto {
  @ApiProperty({ type: [PlatformPreferenceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlatformPreferenceItemDto)
  preferences!: PlatformPreferenceItemDto[];
}
