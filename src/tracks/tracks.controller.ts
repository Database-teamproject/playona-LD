import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CreateLinkDto } from '../links/dto/link.dto';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { TrackResponseDto } from './dto/track.dto';
import { TracksService } from './tracks.service';

@ApiTags('Tracks')
@Controller('api/tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Public()
  @Post('resolve')
  @HttpCode(200)
  resolvePost(@Body() dto: CreateLinkDto): Promise<TrackResponseDto> {
    return this.tracksService.resolveByUrl(dto.url);
  }

  @Public()
  @Get('resolve')
  @ApiOperation({
    summary: 'Resolve a track from a platform URL',
    description:
      'Returns normalized track metadata and matched platform URLs for the given music URL.',
  })
  @ApiQuery({ name: 'url', required: true, example: 'https://open.spotify.com/track/abc123' })
  @ApiResponse({ status: 200, type: TrackResponseDto })
  resolve(@Query('url') url: string): Promise<TrackResponseDto> {
    return this.tracksService.resolveByUrl(url);
  }

  @Public()
  @Get(':trackUuid')
  @ApiOperation({ summary: 'Get track details' })
  @ApiResponse({ status: 200, type: TrackResponseDto })
  findOne(@Param('trackUuid') trackUuid: string): Promise<TrackResponseDto> {
    return /^\d+$/.test(trackUuid)
      ? this.tracksService.findByTrackId(Number(trackUuid))
      : this.tracksService.findByUuid(trackUuid);
  }
}
