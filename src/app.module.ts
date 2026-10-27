import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PlatformsModule } from './platforms/platforms.module';
import { TracksModule } from './tracks/tracks.module';
import { LinksModule } from './links/links.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    PlatformsModule,
    TracksModule,
    LinksModule,
  ],
  controllers: [HealthController],
  providers: [
    // 전역 인증 — @Public() 라우트만 예외
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
