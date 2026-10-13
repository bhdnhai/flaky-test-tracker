# Per-Project Upload Token for CI; no user login in iteration 1

Status: accepted

## Context

Iteration 1 has exactly one actor that writes data: the CI pipeline submitting Reports. People only read results. CI is a machine, so it can't do an interactive login, and its credentials live in CI secrets. The company's usual stack includes Keycloak/Cognito with OAuth2, JWT and RBAC, so a reviewer will expect us to say why we didn't use it here.

## Considered options

- **OIDC via Keycloak or Cognito, with RBAC for people and client credentials for CI.** This is the closest to production. But iteration 1 has no permission difference between people: everyone can read every Project and nobody edits anything. Roles with nothing to distinguish would be infrastructure without a requirement. It would also add an identity provider to the local setup.
- **Upload Token for CI plus email/password login for the dashboard.** This protects the dashboard. But we'd be building our own account management (password storage, resets, sessions), which we'd throw away once a real identity provider arrives.
- **Per-Project Upload Token for CI, read-only dashboard with no login, deployed on an internal network.** (chosen) This is the same model Codecov uses for coverage uploads.

## Decision

CI authenticates each Report submission with an **Upload Token** that is bound to one Project. The server stores only a hash of the token. The dashboard has no login and assumes it runs inside the organisation's network (VPN or internal ingress).

## Consequences

- A leaked Upload Token lets someone submit fake Reports to one Project, but not read anything or reach other Projects. The Operator can rotate a Project's Upload Token, which immediately invalidates the old one.
- Anyone on the internal network can read test names and failure output. This is acceptable only under the internal-network assumption, which is recorded in the problem definition.
- Adding OIDC later only affects the dashboard. The CI token path stays unchanged, because machines would still use Upload Tokens or client credentials.
- RBAC is a non-goal until there is an action that some people may do and others may not (for example quarantining a Test or managing Projects).

## Addendum (2026-10-13): reachability from GitHub-hosted runners

GitHub-hosted runners run on the public internet and can't reach an internal-only deployment. The production deployment therefore exposes **only `POST /api/v1/reports`** publicly, through a load balancer path rule with a rate limit. The dashboard and the read API stay internal. The public route accepts only token-authenticated Reports and returns no data, so the no-login dashboard remains behind the network boundary. Organisations that use only self-hosted runners can keep everything internal. Iteration 1 runs locally and builds neither variant (see `docs/03-design.md` §10).
