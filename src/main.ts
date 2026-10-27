import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupApp } from './setup';

/**
 * 로컬 개발용 엔트리포인트 (`npm run start:dev`)
 * Lambda 배포 시에는 lambda.ts 의 handler 가 진입점이 됨
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 8080;

  await app.listen(port);
  Logger.log(`🚀 Playona API: http://localhost:${port}`, 'Bootstrap');
  Logger.log(`📚 Swagger UI: http://localhost:${port}/docs`, 'Bootstrap');
}

void bootstrap();
