/**
 * Two concurrent "jobs" each wait a random delay then push their id onto a shared log; the test
 * asserts a fixed completion order. By symmetry of two i.i.d. racing delays, P(fail) is ~50%
 * regardless of the exact delay range — confirmed on host and under `--cpus=0.5` in Docker by the
 * reporter-output-and-flakiness prototype (A8, .scratch/prototypes/reporter-output-and-flakiness/
 * handoff-back.md). No seed, no attempt counter, no environment variable (AC-29).
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
