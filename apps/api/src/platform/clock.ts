/** Where "now" comes from (design §4): a system adapter for the worker, a test adapter for tests. */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** A settable clock for tests, so expiry and back-off (AC-17) don't need real sleeping. */
export class TestClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  advanceBy(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
