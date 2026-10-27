import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlatformResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Spotify' })
  name!: string;

  @ApiProperty({ example: 'spotify' })
  slug!: string;

  @ApiPropertyOptional({ example: 'https://...' })
  logoUrl!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;
}
