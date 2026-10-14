# AI usage

Summary of how AI was used on this assignment. It is condensed from a per-step working log kept outside the repository. The commit history and each ticket's `## Comments` hold the details.

## Tools

- **Claude Code** (Anthropic Claude models) in the terminal, for every step from problem definition to these validation docs.
- **Agent skills** (the `mattpocock-skills` and `superpowers` plugins): `grill-with-docs` for the problem definition, `prototype` and `handoff` for the reporter-output prototype, `to-spec` for the SRS, `codebase-design` for the design, `to-tickets` for the ticket breakdown, and `implement` with `tdd` and `code-review` for tickets 01–02 and 17. From ticket 04 to 16, skills were turned off to save tokens. Ticket 03 used `implement` and `tdd` but skipped the review pass.

## Who did what

| Area | AI | Engineer |
|---|---|---|
| Problem choice | Scored 6 candidate problems | Chose the flaky test tracker and supplied the problem evidence (GitHub Actions with Playwright and Jest/Vitest, and how each one flakes) |
| Problem, SRS, design, ADRs | Drafted all the text and diagrams, asked the clarifying questions with recommendations, checked current package versions against the registry, ran a scripted traceability check | Answered or delegated each question after reading the recommendation; set the scope and the non-goals; added the "≤ 3 commands, ≤ 5 minutes" reviewer criterion |
| Prototype | Wrote fixture suites for 3 runners and a 20-run harness, and recorded the findings | Read the raw XML and **rejected** the AI's identity recommendation (see below) |
| Code, tests, scripts, CI | Wrote essentially all of it, ticket by ticket, test-first where the skill was active | Set the commit policy; reviewed each ticket's plan and its deviations; made the calls recorded in each ticket's Comments |
| Verification | Ran the suites and the load scripts and recorded the measured numbers | Ran the demo flow by hand on the Compose stack for tickets 06 and 16 |

## AI suggestions that were rejected

| Suggestion | Why it was rejected |
|---|---|
| A demo built from pre-recorded Reports and fixtures scripted to fail on a given attempt | That would simulate the product working instead of showing it. The demo was changed to a genuinely flaky suite run live (FR-31, ADR-0004). |
| Put `<testsuite hostname>` into Test identity (from the prototype) | In Vitest's output `hostname` is the machine name, so every Test would have become new on each CI runner. ADR-0005 uses `classname` + `name` plus Collision detection instead. |
| The first commit, which included the agent skill config and the prompt playbook | Those files stay out of the history. The repository was re-initialised. |
| Catch the Report unique violation in ticket 02 | That is FR-12, which belongs to ticket 07. Building it early would have blurred the ticket boundary, so it was left as a named gap and done in 07. |
| A no-op `worker` Compose service in ticket 02 to match the design diagram | Speculative: there was no processing code yet. The service arrived with ticket 03. |

## What AI got wrong, and how it was caught

- **The design specified `processEntities: false`.** In fast-xml-parser that switch also turns off the predefined entities, so Vitest's `&gt;` in test names would have been stored undecoded. The ticket 03 unit tests on real reporter XML caught it (SRS v1.4).
- **Bare `<testsuite>` roots silently produced zero Outcomes.** Found by hand on the live stack in ticket 03.
- **nginx's 1 MB default body limit** blocked NFR-01 entirely. Found only when the k6 script actually ran (ticket 12, SRS v1.5).
- **Code review caught real bugs**: a body-parser `413` returned as `500`, path params reaching Prisma unchecked (`500` instead of `404`), and a wrong `Content-Type` silently storing an empty Report with `202`. The ticket 02 review also caught a module-boundary gap in the design (SRS v1.3).
- **Tooling incident.** A bare `code-review` skill name resolved to a different, built-in skill. It forked itself into 10 background agents before the engineer noticed and stopped it. The review was re-run with the scoped name.

## Limits of this account

- Most tickets from 04 onward had no separate AI review pass, because skills were turned off to save tokens. Ticket 17 ran one review over the whole iteration instead; its findings are in [validation §7](04-validation.md#7-technical-debt).
- The AI-written code was not reviewed line by line by the engineer. Review effort went to plans, deviations, test names against ACs and the hand-run demo.
