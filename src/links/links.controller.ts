import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CreateLinkDto, SharedLinkResponseDto } from './dto/link.dto';
import { LinksService } from './links.service';

@ApiTags('Links')
@Controller('api/links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary: 'Create a shared link',
    description: 'Creates a short link from a platform URL. Anonymous users are also allowed.',
  })
  @ApiResponse({ status: 200, type: SharedLinkResponseDto })
  create(
    @Body() dto: CreateLinkDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<SharedLinkResponseDto> {
    return this.linksService.create(dto.url, user?.userId ?? null);
  }

  // 주의: ':shortCode' 보다 먼저 선언해야 'my' 가 경로 파라미터로 잡히지 않음
  @Get('my')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'List my links' })
  @ApiResponse({ status: 200, type: [SharedLinkResponseDto] })
  findMine(@CurrentUser('userId') userId: number): Promise<SharedLinkResponseDto[]> {
    return this.linksService.findMine(userId);
  }

  @Delete(':shortCode')
  delete(@Param('shortCode') shortCode: string, @CurrentUser('userId') userId: number) {
    return this.linksService.delete(shortCode, userId);
  }

  @Post(':shortCode/rematch')
  @HttpCode(HttpStatus.OK)
  rematch(@Param('shortCode') shortCode: string, @CurrentUser('userId') userId: number) {
    return this.linksService.rematch(shortCode, userId);
  }

  @Public()
  @Get(':shortCode/platforms')
  getPlatforms(@Param('shortCode') shortCode: string) {
    return this.linksService.getPlatformUrls(shortCode);
  }

  @Public()
  @Get(':shortCode')
  @ApiOperation({ summary: 'Get a shared link' })
  @ApiResponse({ status: 200, type: SharedLinkResponseDto })
  findOne(@Param('shortCode') shortCode: string): Promise<SharedLinkResponseDto> {
    return this.linksService.findByShortCode(shortCode);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':shortCode/redirect')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary: 'Get a platform URL and count a click',
    description: 'Returns JSON for SPA navigation, matching the Spring API.',
  })
  @ApiQuery({ name: 'platform', required: false, example: 'spotify' })
  @ApiResponse({
    status: 200,
    description: 'Returns the preferred URL or available platform URLs.',
  })
  redirect(
    @Param('shortCode') shortCode: string,
    @CurrentUser() user?: AuthUser,
    @Query('platform') platform?: string,
  ) {
    return this.linksService.redirect(shortCode, user?.userId ?? null, platform);
  }
}
