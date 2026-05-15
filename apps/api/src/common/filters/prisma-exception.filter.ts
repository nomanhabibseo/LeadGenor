import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

function json(res: Response, status: number, message: string) {
  res.status(status).json({ statusCode: status, message });
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientKnownExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const code = exception.code;
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = exception.message;

    switch (code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = `Unique constraint failed (${String((exception.meta as { target?: unknown })?.target ?? 'field')}).`;
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found.';
        break;
      case 'P2022': {
        const col = (exception.meta as { column?: string } | undefined)?.column;
        const hint = col ? ` Missing: ${col}.` : '';
        message = `Database schema is behind the app.${hint} From repo root run: npm run db:migrate:deploy then npm run db:generate. On Windows, stop the API dev server first if generate reports a file lock (EPERM).`;
        break;
      }
      case 'P1001':
      case 'P1000':
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Cannot reach the database. Check DATABASE_URL and that Postgres is running.';
        break;
      case 'P1017':
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Database closed the connection. Retry after a moment.';
        break;
      default:
        message = `Database error (${code}). ${exception.message}`;
    }

    json(res, status, message);
  }
}

@Catch(Prisma.PrismaClientValidationError)
export class PrismaClientValidationExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const dev = process.env.NODE_ENV !== 'production';
    const message = dev
      ? `Invalid database query: ${exception.message.slice(0, 800)}`
      : 'Invalid database query.';
    json(res, HttpStatus.INTERNAL_SERVER_ERROR, message);
  }
}
