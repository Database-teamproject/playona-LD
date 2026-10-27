import { configure } from '@codegenie/serverless-express';
import { ExpressAdapter } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import type { Context, Handler } from 'aws-lambda';
import { AppModule } from './app.module';
import { setupApp } from './setup';

/**
 * AWS Lambda 핸들러
 * @codegenie/serverless-express 어댑터로 NestJS 앱 전체를 API Gateway 뒤에 올림
 *
 * NestApp 은 Lambda 컨테이너가 살아있는 동안 캐싱 — 콜드스타트는 최초 1회만
 */
let cachedHandler: Promise<Handler> | undefined;

async function bootstrap(): Promise<Handler> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  setupApp(app);
  await app.init();
  return configure({ app: expressApp });
}

export const handler: Handler = async (event, context: Context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  cachedHandler ??= bootstrap().catch((error: unknown) => {
    cachedHandler = undefined;
    throw error;
  });
  return (await cachedHandler)(event, context, callback);
};
