# Retrospective: iteration 1

About two working days, 2026-10-12 to 2026-10-14, plus a second validation pass the same day. Measured against [the validation](04-validation.md).

## What went well

- **The prototype paid for itself before any code existed.** Three runners' real JUnit output, read before the SRS, refuted A2 ("`classname` + `name` is unique"). It also showed that the obvious fix of adding `hostname` to identity would have broken Vitest on every CI runner. The result was ADR-0005 and Collision detection: a requirement nobody would have written from first principles.
- **Genuinely flaky fixtures instead of a scripted demo.** The completion-order race gives about 50% failure on any machine, so the demo shows the real product on real evidence in under 30 seconds. Rejecting the first, simulated demo design was the single most valuable "no" of the iteration.
- **Testing against real PostgreSQL.** Flake detection, `SKIP LOCKED` claiming, the duplicate race and idempotency are all SQL behaviour. Testcontainers and a test clock made them fast, deterministic tests with no sleeps (AC-17, AC-22).
- **Running things instead of trusting them.** Three of the five SRS revisions (v1.2, v1.4, v1.5) came from executing something: package engine fields (Node ≥ 22.22), real reporter XML (`&gt;` in names), a leftover Report shape (zero Outcomes), and k6 (nginx's 1 MB limit). None of these was visible on paper. The other two came from design work (v1.1) and code review (v1.3).
- **Thin vertical tickets.** The core loop was demoable at ticket 05 and the reviewer path at 06. Everything after that was hardening that could have been cut without losing the product.

## What didn't go well

- **The tests of a flaky-test tracker contain a flaky test.** `reports.spec.ts` asserts a Report is still `pending` and races the 500 ms worker. It was flagged in tickets 04, 06 and 11 and failed again during validation. Each time it was "out of scope". It should have been a one-line fix the first time. (Fixed in ticket 18, re-confirmed stable over 3 clean runs during the second validation pass.)
- **Review discipline faded as the budget tightened.** Tickets 01–02 had a two-axis review, and it found real bugs each time. From ticket 03 onward the review was skipped to save tokens. The single review in ticket 17 then found 8 spec defects, including two Must dashboard requirements that were only partly met (FR-29, FR-30). One of them, the Collision warning text, had been explicitly handed from ticket 08 to ticket 11 and then dropped.
- **"Done" sometimes meant "the AC test passes", not "the FR is met".** The ACs didn't check per-Commit counts or the Collision warning text, so their tests stayed green while the FRs were incomplete. Validating against FR text, not only AC text, would have caught this earlier.
- **Debt that gets written down doesn't get paid down by itself.** Ticket 21 was scoped, specific and ready (`Status: ready-for-agent`) to fix NFR-10's logging gap and the worker's unhandled-DB-error path. Nobody ever ran it — it sat unimplemented through two rounds of "fix the open defects" (tickets 19–20) because those two had an explicit ask behind them and ticket 21 didn't. A ticket existing is not the same as a ticket happening.
- **A second review pass still found something the first one missed.** Re-running the same two-axis review over the current `HEAD` (after tickets 18–20) surfaced a small terminology slip — Test detail labels a column "Run", which CONTEXT.md says iteration 1 deliberately doesn't have as a concept — that the first review didn't catch. One review is not a ceiling on what's wrong; it's a sample.
- **No GitHub remote.** The CI workflow, the dogfood job (AC-31) and the A4/A8 checks were written but never run where they're meant to run. Pushing to a throwaway repository on day 1 would have cost minutes. Still true at the second pass.
- **The SRS contradicts itself on claim expiry.** NFR-04 says "within 60 s"; §8 says "older than 60 s". The review found it; drafting didn't.

## What I'd change next time

1. Push to a real remote on day 1 and keep CI green from the walking skeleton onward.
2. Treat review as part of done, not as optional extra cost. A smaller review on every ticket beats one large review at the end.
3. Fix test flakiness the first time it's seen, especially in this product.
4. Before closing a ticket, write each AC check against the FR text, and let the ticket list FR clauses that no AC covers.
5. Keep the handoff between tickets explicit. "Ticket 11's page audit" was a note in a comment, not a scope line in ticket 11.
6. Don't call a defect "handled" once it has a ticket number. It's handled once the ticket has a commit. Track "scoped but not run" as its own state, separate from "open" and "fixed", so it doesn't quietly look done in a list.

## Numbers

- 21 tickets total: 16 feature, 1 docs, 4 post-validation fixes; 19 commits (two pairs of tickets shared a commit because they touched the same file).
- 35/35 FRs built; 0 ❌. At first validation: 12 ⚠️. After tickets 18–20: 3 ⚠️ remain (NFR-10/D-07, FR-34/AC-31, NFR-12/AC-39 in CI) plus one new minor finding (D-17, a terminology label) from the second pass.
- 41 unit, 70 integration and 13 E2E tests, all green on a fresh run; JUnit module at 100% line, 90.5% branch coverage.
- p95 (ticket 12, not re-measured since): submission 79 ms (target < 300), processing 0.9 s (< 5 s), reads ≤ 116 ms (< 500).
- 7 SRS revisions after the v1.0 baseline (v1.1 … v1.7), each with a recorded trigger.
