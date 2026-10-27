import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ProfileImageService } from './profile-image.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, ProfileImageService],
  exports: [UsersService],
})
export class UsersModule {}
