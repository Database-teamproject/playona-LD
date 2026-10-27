import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PlatformResponseDto } from './dto/platform.dto';
import { PlatformsService } from './platforms.service';

@ApiTags('Platforms')
@Controller('api/platforms')
export class PlatformsController {
  constructor(private readonly platformsService: PlatformsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List supported platforms',
    description: 'Returns the list of currently active music platforms.',
  })
  @ApiResponse({ status: 200, type: [PlatformResponseDto] })
  findAll(): Promise<PlatformResponseDto[]> {
    return this.platformsService.findActive();
  }
}
