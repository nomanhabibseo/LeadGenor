import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';
import {
  PrismaClientKnownExceptionFilter,
  PrismaClientValidationExceptionFilter,
} from './common/filters/prisma-exception.filter';
import { heavyEmailSchedulersEnabled } from './common/email-schedulers-allow';

async function bootstrap() {
  /** Disable Nest’s default JSON parser so we can raise the limit for CSV/sheet imports. */
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '20mb' }));
  app.useGlobalFilters(new PrismaClientKnownExceptionFilter(), new PrismaClientValidationExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const configuredWeb = (process.env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
  const extraWebOrigins = (process.env.WEB_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const allowedOrigins = new Set([
    configuredWeb,
    ...extraWebOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, allowedOrigins.has(origin));
    },
    credentials: true,
  });
  const port = Number.parseInt(process.env.PORT ?? '4000', 10) || 4000;
  /** Render / Docker: must listen on all interfaces, not only loopback. */
  await app.listen(port, '0.0.0.0');
  const emailSchedulersOn = heavyEmailSchedulersEnabled();
  if (!emailSchedulersOn) {
    const log = new Logger('Bootstrap');
    log.warn(
      'Campaign email schedulers are OFF (typical when using `npm run start:dev`). RUNNING campaigns will stay at PENDING until you set ENABLE_EMAIL_SCHEDULERS_IN_DEV=1 in .env and restart the API.',
    );
  }
}
bootstrap();
