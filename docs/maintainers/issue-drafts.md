# Contribution backlog

Some proposals below have GitHub issues or merged implementations; others remain drafts. Check the linked issue and PR before starting work. Suggested labels use existing repository labels and do not mean that a draft is already published or assigned.

## Status checked on 3 October 2026

| Work | Public record | Verified status / next step |
| --- | --- | --- |
| Synthetic demo article | [#540](https://github.com/discours/discoursio-webapp/issues/540) | GitHub issue is closed, but current `dev` still returns empty collections and null article/author/topic records. A populated article and its tests are not implemented; issue closure is not evidence of that feature. Coordinate with a maintainer before starting this historical proposal. |
| npm command reference | [#541](https://github.com/discours/discoursio-webapp/issues/541), [PR #547](https://github.com/discours/discoursio-webapp/pull/547) | Completed and merged. Do not recreate this task. |
| Separate browser suites | [#542](https://github.com/discours/discoursio-webapp/issues/542), [PR #548](https://github.com/discours/discoursio-webapp/pull/548), [PR #552](https://github.com/discours/discoursio-webapp/pull/552) | Demo CI and expanded public-shell/mobile-menu smoke coverage are merged into `dev`. Historical test classification and named prerequisite checks remain open in #542. Do not duplicate the merged smoke work. |
| Scoped accessibility baseline | [#543](https://github.com/discours/discoursio-webapp/issues/543), [PR #549](https://github.com/discours/discoursio-webapp/pull/549) | The HeaderControls button-type change is already in a draft PR; manual interaction checks remain. Do not duplicate that patch. |
| GraphQL snapshot provenance | [#544](https://github.com/discours/discoursio-webapp/issues/544) | Open; authoritative backend ownership and update workflow still need agreement. |
| Demo API HTTP tests | [#553](https://github.com/discours/discoursio-webapp/issues/553), [starter guide](../development/first-contribution.md#small-test-only-task) | Open `good first issue`, with a contributor expressing interest and a maintainer follow-up awaiting a branch or PR. Check the latest issue comments and coordinate before starting. No account or live backend needed. |

The demo-article status above was checked against `dev` commit `baa733a4ef4f6811a0d11ec36f85e41386329041`, not inferred from issue closure or a green CI badge. Merge, release, and deployment remain separate states.

## Original proposals and acceptance criteria

## 1. Add one synthetic article to the local demo fixture

Labels: `good first issue`, `enhancement`

The read-only demo currently proves startup and empty states but gives a newcomer little UI to inspect. Add one clearly synthetic, licence-safe article with an author, topic, cover placeholder, and basic stats.

Acceptance criteria:

- Fixture contains no copied Discours or user content.
- Home feed and article route render the synthetic record.
- Demo remains loopback-only and read-only.
- Unit and demo Playwright smoke cover the record.
- README states exactly what the fixture does and does not emulate.

## 2. Verify and modernise the npm command reference

Labels: `good first issue`, `documentation`

Audit `docs/development/npm-scripts.md` and `docs/reference/commands.md` against `package.json`; remove nonexistent scripts and document demo, codegen, unit, build, and service-dependent E2E commands.

Acceptance criteria:

- Every documented command exists and has been run or is explicitly marked service-dependent.
- No unsupported package-manager alternatives are presented as equivalent to the npm lockfile.
- No performance, coverage, or production claims are added without evidence.

## 3. Split Playwright into deterministic and service-dependent suites

Labels: `help wanted`, `enhancement`

The 35 historical specs mix public, authenticated, editor, and live-service assumptions. Classify them and move deterministic scenarios to a fixture-backed project that can run in CI.

Acceptance criteria:

- Tests are tagged or grouped as `demo`, `integration`, and `authenticated`.
- Deterministic tests use synthetic data and no account credentials.
- Service-dependent tests fail fast with named missing prerequisites.
- CI runs a small stable demo suite and uploads artifacts only on failure.

## 4. Establish the first enforceable accessibility lint baseline

Labels: `help wanted`, `enhancement`

Biome accessibility rules are broadly disabled. Choose one small rule group, fix the resulting violations in a bounded component area, and enable those rules without mass suppression.

Acceptance criteria:

- Scope and affected components are agreed before implementation.
- Keyboard and screen-reader behaviour is manually checked.
- New suppressions include a concrete reason.
- `npm run lint`, type-check, unit tests, build, and demo smoke pass.

## 5. Replace privacy-unsafe debug logging with bounded diagnostics

Labels: `enhancement`

Session token and auth-payload logging is fixed, but other contexts still log GraphQL responses, SSE payloads, upload bodies, or user/session objects. Audit browser and server logs and standardise safe event-level diagnostics.

Acceptance criteria:

- No tokens, credentials, request bodies, private content, personal fields, or provider responses are logged.
- Errors expose a stable category and request status where safe, not raw objects.
- Development diagnostics can be enabled explicitly.
- Regression tests cover the auth/OAuth redaction boundary.

## 6. Design a coordinated migration away from browser token storage

Labels: `enhancement`

Authentication still supports tokens in `localStorage`. Produce an RFC for an httpOnly, secure, same-site cookie flow coordinated with the backend; do not change the client contract in isolation.

Acceptance criteria:

- Threat model covers XSS, OAuth callbacks, CSRF, refresh, logout, SSR, and multiple tabs.
- Backend and frontend contract changes and rollout sequence are explicit.
- Test and rollback plans are included.
- No production migration occurs through this issue without separate approval.

## 7. Add deployment-level abuse controls for feedback and newsletter endpoints

Labels: `enhancement`

Handlers now validate bounded input and hide provider errors, but they still need rate limiting and bot/abuse controls at the actual hosting boundary.

Acceptance criteria:

- Hosting target and available free controls are confirmed from live configuration.
- Limits are defined per route with privacy-safe keys and clear failure responses.
- Legitimate same-origin submissions continue to work.
- Logs and alerts contain no email address, message body, or provider credential.

## 8. Define an upstream process for GraphQL compatibility snapshots

Labels: `enhancement`, `documentation`

Local schemas make builds reproducible, but part of the compatibility layer was reconstructed from current operations and repository history. Define how a verified backend schema updates this repository.

Acceptance criteria:

- Authoritative core and inbox schema owners are named.
- Update command, provenance metadata, review checklist, and drift test are documented.
- Compatibility-only fields are distinguishable from verified upstream fields.
- Codegen remains offline by default.

## 9. Reconcile `dev` and `main` and establish a protected release flow

Labels: `enhancement`, `documentation`

Roadmap item. The default `dev` branch is unprotected and differs substantially from protected `main`; the repository has no tags or GitHub releases.

Acceptance criteria:

- Maintainers explain the intended role of each branch.
- A non-destructive reconciliation plan accounts for both histories.
- Required CI and review rules are proposed for the contribution branch.
- Tag, changelog, release, and deployment are documented as separate actions.

## 10. Remove ineffective editor chunk boundaries and set a measured bundle budget

Labels: `enhancement`

Roadmap item. Vite reports editor modules that are both statically and dynamically imported, so those dynamic imports do not split chunks. Map the boundaries and optimise only where measurement supports it.

Acceptance criteria:

- Baseline client chunks are recorded with a reproducible command.
- Mixed import paths are documented and then simplified or intentionally retained.
- Editor behaviour has focused regression coverage.
- A realistic warning or budget is added without claiming unmeasured performance gains.
