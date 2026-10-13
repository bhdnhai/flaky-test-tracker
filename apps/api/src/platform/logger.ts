import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DestinationStream } from 'pino';
import type { Options } from 'pino-http';

/** Accepts the inbound `X-Request-Id`, or generates one, and echoes it on every response (NFR-10). */
function genReqId(req: IncomingMessage, res: ServerResponse): string {
  const header = req.headers['x-request-id'];
  const id = typeof header === 'string' && header !== '' ? header : randomUUID();
  res.setHeader('X-Request-Id', id);
  return id;
}

/**
 * pino-http config shared by `api`, `worker` and `cli` (design §9): structured JSON logs,
 * request id correlation, and redaction of the upload token's carrier header (NFR-06).
 * `stream` is overridden in tests to capture output instead of writing to stdout.
 */
export function pinoHttpOptions(stream?: DestinationStream): Options {
  return {
    genReqId,
    redact: ['req.headers.authorization'],
    stream,
  };
}
