# Draft release: v0.16.0 — Contributor foundation

Status: **draft only — do not publish**

Target branch: `dev`

Date: TBD

## Summary

This candidate makes the historical SolidStart application reproducible for public contributors without requiring a reachable Discours backend. It also closes concrete security flaws, replaces misleading setup/CI documentation, and establishes a minimal governance and maintenance surface.

## Highlights

- `npm ci` has no implicit codegen, browser download, package installation, or trust-store mutation.
- `npm run dev:demo` provides a deterministic, loopback-only, read-only GraphQL fixture.
- Local GraphQL compatibility schemas and generated clients allow clean offline codegen and type-checking.
- CI targets `dev` and `main` on Node 24 and verifies codegen, lint, types, unit tests, runtime audit, and production build.
- Standard README, contributing, security, conduct, maintainer, roadmap, issue, pull-request, CODEOWNERS, and Dependabot files are included.

## Security

- Static file requests can no longer escape `.output/public` through plain or encoded traversal.
- OAuth/session payloads and upload bearer-token previews are no longer written to browser logs; a regression test covers both upload runtimes.
- Feedback and newsletter handlers validate bounded input and hide mail-provider responses and errors.
- Runtime dependencies report zero known vulnerabilities under `npm audit --omit=dev` at candidate validation time.

## Contributor changes

- Node.js 20.19+ and npm 10+ are required; Node 24 is recommended.
- Vite is pinned to 6.4.3 because Vinxi 0.5 does not consume Vite 7's manifest path.
- Local HTTPS setup is optional and explicit through `npm run setup:https`.
- Authenticated Playwright scenarios require a dedicated test account; no fallback credentials are bundled.

## Candidate validation

- Local GraphQL codegen: passed
- TypeScript: passed
- Unit tests: passed (11)
- Production build: passed
- HTTP demo smoke: passed
- Playwright Chromium demo smoke: passed
- Runtime dependency audit: zero known findings
- Pull-request CI: `quality` and `dependency-review` passed

These checks validate the candidate checkout and pull-request CI, not a published package, release artifact, or production deployment.

## Known limitations

- External core, inbox, realtime, mail, analytics, and deployment integrations were not end-to-end verified.
- Historical Playwright suites still need classification and reliable fixtures.
- The full dev-tooling dependency graph still contains audit findings with no safe automatic fix; runtime dependencies are clean.
- `dev`/`main` divergence, branch protection, private vulnerability reporting, and the operational Gitea workflow require maintainer decisions.
- No tag, GitHub release, merge, or deployment is part of this draft.
