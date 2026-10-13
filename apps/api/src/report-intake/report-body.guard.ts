import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ApiError } from '../platform/index.js';

const XML_CONTENT_TYPE = /^(application|text)\/xml\b/i;

/**
 * Design §5 steps 2 and 4, run as a guard so they land before the commit/metadata pipes
 * (step 5) and the XML pre-check (step 6, run from the controller once those pipes pass).
 * Step 3 (size) is enforced earlier still, by the raw-body parser in app.ts.
 */
@Injectable()
export class ReportBodyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const contentType = request.headers['content-type'];
    if (!contentType || !XML_CONTENT_TYPE.test(contentType)) {
      throw new ApiError(
        'UNSUPPORTED_MEDIA_TYPE',
        'Content-Type must be application/xml or text/xml',
      );
    }

    const body = request.body as unknown;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new ApiError('EMPTY_REPORT', 'Report body must not be empty');
    }

    return true;
  }
}
