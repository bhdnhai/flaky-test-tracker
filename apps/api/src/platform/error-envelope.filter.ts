import { randomUUID } from 'node:crypto';
import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { ErrorCode, ErrorEnvelope } from '@ftt/contracts';
import type { Request, Response } from 'express';
import { ApiError, statusByCode } from './api-error.js';

/** Codes for errors raised by Nest or Express themselves (SRS §9.1 table). */
const codeByFrameworkStatus: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
  413: 'REPORT_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
};

/** Turns every error into the SRS §9.1 error envelope. */
@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const { status, code, message } = toEnvelopeParts(exception);
    const body: ErrorEnvelope = { error: { code, message, requestId: requestIdOf(req) } };
    res.status(status).json(body);
  }
}

interface EnvelopeParts {
  status: number;
  code: ErrorCode;
  message: string;
}

function toEnvelopeParts(exception: unknown): EnvelopeParts {
  if (exception instanceof ApiError) {
    return {
      status: statusByCode[exception.code],
      code: exception.code,
      message: exception.message,
    };
  }
  const client = clientErrorOf(exception);
  const code = client && codeByFrameworkStatus[client.status];
  if (client && code) return { status: client.status, code, message: client.message };
  return { status: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' };
}

/**
 * A client error raised by the framework: a Nest HttpException, or an Express middleware
 * error (body-parser's 413, for example) that follows the http-errors convention.
 */
function clientErrorOf(exception: unknown): { status: number; message: string } | undefined {
  if (exception instanceof HttpException) {
    return { status: exception.getStatus(), message: exception.message };
  }
  if (
    exception instanceof Error &&
    'expose' in exception &&
    exception.expose === true &&
    'status' in exception &&
    typeof exception.status === 'number'
  ) {
    return { status: exception.status, message: exception.message };
  }
  return undefined;
}

// pino-http (ticket 10) sets `req.id` and echoes it as X-Request-Id before this filter runs;
// the fallback only applies outside a full app (e.g. this filter's own unit test).
function requestIdOf(req: Request): string {
  const id: unknown = req.id;
  return typeof id === 'string' && id !== '' ? id : randomUUID();
}
