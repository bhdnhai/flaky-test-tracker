# Test identity is `classname` + `name` as reported; collisions are detected, not guessed

Status: accepted

## Context

Every Outcome has to be attached to a Test, and Flakes only exist if the same Test is recognised across Reports (ADR-0004). The prototype on branch `prototype/reporter-output-and-flakiness` ([findings](../../.scratch/prototypes/reporter-output-and-flakiness/handoff-back.md)) showed:

- `classname` + `name` is stable across runs for Vitest, Playwright and jest-junit.
- It is **not unique** in two common setups:
  - Playwright with several projects (for example chromium and firefox) emits byte-identical `classname` + `name` for each project. The project appears only in `<testsuite hostname="chromium">`.
  - jest-junit's default templates (`"{classname} {title}"`, space as the separator, no file path) produce identical identities for tests with the same wording in different files.
- `<testsuite hostname>` means different things per reporter. Playwright puts the project name there; **Vitest puts the machine's hostname** there (`MacBook-Air-von-admin.local` on a laptop, a container ID in Docker), which changes with every GitHub-hosted runner.

If two different tests share an identity, then chromium passing while firefox fails on the same Commit would be reported as a Flake, even though it is a real browser-specific failure. That is exactly the false verdict the product exists to prevent.

## Considered options

- **Add `<testsuite hostname>` to the identity.** This was the prototype's own recommendation. It fixes Playwright, but it gives every Vitest Test a new identity on each runner machine, so no Vitest Flake would ever be found. Rejected.
- **Detect the reporter and apply reporter-specific rules.** For example, Playwright's root `<testsuites>` has `id="" name=""`, while Vitest's has `name="vitest tests"`, so we could interpret `hostname` only for Playwright. This needs no configuration from users. But it ties the parser to undocumented, unversioned details of three reporters' output, which breaks the "any JUnit XML" contract (non-goal 9) and fails silently when a reporter changes.
- **`classname` + `name` exactly as reported; uniqueness comes from documented reporter options; the product detects collisions.** (chosen)

## Decision

- A Test is identified by Project + `classname` + `name`, exactly as reported. The product never interprets `hostname` or any other reporter-specific attribute.
- The CI setup documentation requires the official options that make identities unique:
  - Playwright with more than one project: `includeProjectInTestName: true`.
  - jest-junit: a `classNameTemplate` that includes `{filepath}`.
  - Vitest's defaults (file path in `classname`, `describe` path joined with ` > ` in `name`) are already unique.
- If one Report contains the same `classname` + `name` more than once, those Tests are **excluded from Flake detection for that Report**. The Report is marked with a warning that names the colliding Tests and the reporter option that fixes it.

## Consequences

- No false Flakes from identity collisions; the worst case is missing evidence, and it comes with a visible warning.
- Teams that forget the option see the warning in the Reports list, not a silent wrong answer.
- Changing the reporter option changes the identities, so existing Tests restart their history under new names. This is acceptable for iteration 1 (tracking renames is non-goal 3), and the raw Reports (ADR-0003) allow re-processing if this rule changes.
- The demo fixtures must use these options too, so the demo matches the documented setup.
