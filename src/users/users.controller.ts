import {
  Body,
  Controller,
  Get,
  HttpCode,
  ParseArrayPipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileImageService, UploadedImage } from './profile-image.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  PlatformPreferenceResponseDto,
  PlatformPreferenceItemDto,
  UpdateUserDto,
  UserResponseDto,
} from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('bearerAuth')
@Controller('api/users/me')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly images: ProfileImageService,
  ) {}

  @Post('profile-image')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async uploadProfileImage(
    @CurrentUser('userId') userId: number,
    @UploadedFile() file?: UploadedImage,
  ) {
    const user = await this.usersService.getMe(userId);
    const profileImageUrl = await this.images.upload(user.userUuid, file);
    return this.usersService.updateMe(userId, { profileImageUrl });
  }

  @Get()
  @ApiOperation({ summary: 'Get my profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  getMe(@CurrentUser('userId') userId: number): Promise<UserResponseDto> {
    return this.usersService.getMe(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Update my profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  updateMe(
    @CurrentUser('userId') userId: number,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateMe(userId, dto);
  }

  @Get('platforms')
  @ApiOperation({ summary: 'Get my platform preferences' })
  @ApiResponse({ status: 200, type: [PlatformPreferenceResponseDto] })
  getPreferences(@CurrentUser('userId') userId: number): Promise<PlatformPreferenceResponseDto[]> {
    return this.usersService.getPreferences(userId);
  }

  @Put('platforms')
  @ApiOperation({
    summary: 'Update my platform preferences',
    description: 'Sets the platform priority order from highest to lowest.',
  })
  @ApiResponse({ status: 200, type: [PlatformPreferenceResponseDto] })
  updatePreferences(
    @CurrentUser('userId') userId: number,
    @Body(
      new ParseArrayPipe({
        items: PlatformPreferenceItemDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    items: PlatformPreferenceItemDto[],
  ): Promise<PlatformPreferenceResponseDto[]> {
    return this.usersService.updatePreferences(userId, items);
  }
}
