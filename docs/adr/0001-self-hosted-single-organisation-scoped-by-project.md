# Self-hosted, one organisation per deployment, data scoped by Project

Status: accepted

## Context

The tracker stores test names, file paths and failure output from a team's CI. That data reveals internal code structure. The main reason to use this tool instead of a hosted product (Datadog CI Visibility, BuildPulse, Trunk) is to keep that data in-house without per-seat pricing. Whatever tenancy model we pick now decides how every table is keyed and how every query is filtered.

## Considered options

- **Multi-tenant SaaS (Organisation → Project, signup, tenant isolation).** This is the most flexible commercially. But it needs signup, tenant-aware authorisation on every query and isolation tests, and none of that proves the core value of telling flaky failures from real ones. It also contradicts the "keep your data in-house" positioning.
- **Single project per deployment, no grouping.** This is the simplest option. But most teams have several repositories, and adding a grouping key to every table later means a migration and a change to every query.
- **Self-hosted, one organisation per deployment, all data scoped by Project.** (chosen)

## Decision

One deployment serves one organisation. Every piece of data belongs to exactly one **Project**, and one Project is one repository. There is no Organisation entity in iteration 1.

## Consequences

- Every query is scoped by Project, so adding an Organisation above Project later is an additive change, not a rewrite.
- No tenant-isolation work in iteration 1. The deployment boundary is the isolation boundary.
- Offering this as hosted SaaS would require revisiting this ADR (adding Organisation, signup and isolation tests).
