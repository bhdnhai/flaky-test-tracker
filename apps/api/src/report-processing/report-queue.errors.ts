/** No Report matches the given ID (FR-20, SRS §9.3). */
export class ReportNotFoundError extends Error {
  constructor(reportId: string) {
    super(`Report not found: ${reportId}`);
    this.name = 'ReportNotFoundError';
  }
}

/** Only a `processed` or `failed` Report can be reprocessed (FR-20, SRS §8). */
export class ReportNotReprocessableError extends Error {
  constructor(reportId: string, processingState: string) {
    super(
      `Report ${reportId} is ${processingState}; only processed or failed Reports can be reprocessed`,
    );
    this.name = 'ReportNotReprocessableError';
  }
}
