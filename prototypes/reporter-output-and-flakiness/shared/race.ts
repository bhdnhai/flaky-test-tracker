// Shared by all three fixture suites. Genuine order-dependency race, not a
// scripted failure: two concurrent jobs race to append to a shared log, and
// the assertion wrongly assumes a fixed completion order. Real JS engines
// race timer callbacks against each other, so which job's `push` lands first
// depends on real scheduling jitter, not on attempt number or an env var.
//
// Because both jobs draw their delay from the same distribution, the
// probability that "first" finishes before "second" is ~50% by symmetry,
// regardless of the exact delay range (see prototypes/reporter-output-and-flakiness/README.md).
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
  await Promise.all([job(log, "first"), job(log, "second")]);
  return log;
}
