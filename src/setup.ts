import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { ConfigService } from '@nestjs/config';

/**
 * 로컬(main.ts)·Lambda(lambda.ts) 양쪽에서 공유하는 앱 설정
 * Pipe / Filter / Swagger
 */
export function setupApp(app: INestApplication): void {
  const frontend =
    app.get(ConfigService).get<string>('frontendUrl') ?? 'https://playona-five.vercel.app';
  app.enableCors({
    origin: frontend,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Playona API')
    .setDescription('Cross-platform music sharing service API')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearerAuth')
    .addTag('Auth', 'OAuth login and token management')
    .addTag('Users', 'User profile and platform preferences')
    .addTag('Platforms', 'Supported music platforms')
    .addTag('Tracks', 'Track resolution and platform matching')
    .addTag('Links', 'Shared link creation and redirection')
    .addTag('Health', 'Service health check')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
