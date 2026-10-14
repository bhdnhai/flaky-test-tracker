/**
 * The same completion-order race as `fixtures/flaky-suite/tests/support/race.ts` (ADR-0005: "the
 * demo fixtures must use these options too"), confirmed to hold ~50% across both Playwright
 * projects by the reporter-output-and-flakiness prototype (A8,
 * .scratch/prototypes/reporter-output-and-flakiness/handoff-back.md). No seed, no attempt
 * counter, no environment variable.
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(): number {
  return 2 + Math.random() * 18; // 2-20ms: wide enough to avoid timer-tick ties
}

async function job(log: string[], id: string): Promise<void> {
  await wait(jitter());
  log.push(id);
}

export async function racingLog(): Promise<string[]> {
  const log: string[] = [];
  await Promise.all([job(log, 'first'), job(log, 'second')]);
  return log;
}
