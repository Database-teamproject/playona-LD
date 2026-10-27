import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TrackResponseDto } from '../../tracks/dto/track.dto';

export class CreateLinkDto {
  @ApiProperty({ description: '플랫폼 음악 URL', example: 'https://open.spotify.com/track/abc123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  url!: string;
}

export class SharedLinkResponseDto {
  @ApiProperty()
  trackTitle!: string;

  @ApiProperty()
  trackArtist!: string;

  @ApiProperty()
  thumbnailUrl!: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  platforms!: { slug: string; name: string; url: string; thumbnailUrl: string }[];
  @ApiProperty({ example: '550e8400-e29b-41d4-a716' })
  linkUuid!: string;

  @ApiProperty({ example: 'abc123' })
  shortCode!: string;

  @ApiProperty({ example: 'https://tunify.io/t/abc123' })
  shareUrl!: string;

  @ApiProperty({ type: TrackResponseDto })
  track!: TrackResponseDto;

  @ApiProperty({ example: 42 })
  clickCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
