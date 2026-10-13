import type { DestinationStream } from 'pino';

export interface CapturedLogs {
  stream: DestinationStream;
  /** Every captured line, parsed as JSON, in write order. */
  lines(): Record<string, unknown>[];
  /** The raw, unparsed text written so far (for substring checks, e.g. token absence). */
  raw(): string;
}

/** A synchronous pino destination that buffers writes in memory instead of hitting stdout. */
export function createLogCapture(): CapturedLogs {
  const chunks: string[] = [];
  return {
    stream: { write: (msg: string) => void chunks.push(msg) },
    lines: () =>
      chunks
        .join('')
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
    raw: () => chunks.join(''),
  };
}
