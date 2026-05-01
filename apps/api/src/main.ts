import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  PrismaClientKnownExceptionFilter,
  PrismaClientValidationExceptionFilter,
} from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  const port = process.env.PORT ?? 4000;
  await app.listen(port);
}
bootstrap();
