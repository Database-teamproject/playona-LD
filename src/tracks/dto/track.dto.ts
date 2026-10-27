import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlatformTrackResponseDto {
  @ApiProperty()
  name!: string;
  @ApiProperty({ example: 'spotify' })
  platform!: string;

  @ApiProperty({ example: 'https://open.spotify.com/track/abc123' })
  url!: string;

  @ApiProperty({ example: true })
  isAvailable!: boolean;
}

export class TrackResponseDto {
  @ApiProperty()
  trackId!: number;

  @ApiPropertyOptional()
  sourceUrl!: string | null;
  @ApiProperty({ example: '550e8400-e29b-41d4-a716' })
  trackUuid!: string;

  @ApiPropertyOptional({ example: 'USUM71703861' })
  isrc!: string | null;

  @ApiProperty({ example: 'Blinding Lights' })
  title!: string;

  @ApiProperty({ example: 'The Weeknd' })
  artist!: string;

  @ApiPropertyOptional({ example: 'After Hours' })
  album!: string | null;

  @ApiPropertyOptional({ example: '2019-11-29' })
  releaseDate!: string | null;

  @ApiPropertyOptional({ example: 200040 })
  durationMs!: number | null;

  @ApiPropertyOptional({ example: 'https://i.scdn.co/image/...' })
  thumbnailUrl!: string | null;

  @ApiProperty({ type: [PlatformTrackResponseDto] })
  platformTracks!: PlatformTrackResponseDto[];
}
