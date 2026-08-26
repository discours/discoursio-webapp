# Open-source readiness audit

Audit date: 2026-08-26

Repository: `discours/discoursio-webapp`

Audited branch head: `dev` at `d0cbe2a9` plus the local readiness candidate

## Executive assessment

Overall readiness: **7/10**.

The candidate is technically approachable and buildable: deterministic demo, offline codegen, CI, root-level governance documents, unit coverage for the security fixes, a successful production build, and a clean runtime dependency audit. The score is capped by weak public maintenance signals, unprotected/divergent branches, absent release history, unavailable external-service proof, legacy E2E debt, disabled repository security features, and unresolved dev-tooling audit findings.

Engineering readiness after the candidate is approximately **8/10**; application competitiveness is approximately **6/10** until the work is merged, maintenance visibly resumes, and the repository publishes a credible issue/release rhythm.

## Public repository state

| Signal | Verified state |
| --- | --- |
| Visibility / licence | Public, MIT |
| Default branch | `dev` |
| GitHub activity snapshot | 10 stars, 5 forks, 6 watchers, last push 2025-11-07 |
| Open work | One open pull request; no open issues |
| Releases | No GitHub releases or Git tags |
| Topics | None |
| Branches | `main` protected; `dev` not protected |
| Divergence | `main` has 4 unique commits; `dev` has 2,402 unique commits |
| Repository security features | Dependabot security updates, secret scanning, validity checks, and push protection disabled |

The codebase itself is substantial: 3,941 commits at the audited head, 203 TSX components, 40 route modules, 81 GraphQL operation modules, and 35 Playwright specs. This supports an ecosystem-importance narrative, but it does not substitute for current maintenance evidence.

## Reproducibility and developer experience

### Before

- `postinstall` attempted live GraphQL codegen and hid failures.
- `prepare` could install Playwright and operating-system dependencies.
- generated GraphQL types were ignored, while public schema endpoints were unavailable or incompatible.
- CI used Node 18, watched nonexistent `develop` instead of default `dev`, referenced a missing nginx config, installed unrelated databases, and used a Vite version that broke Vinxi's manifest lookup.
- seven npm scripts referenced files that did not exist.
- local development attempted to install `mkcert`, system packages, and a local CA as a startup side effect.

### Candidate

- `npm ci --ignore-scripts` succeeds from the lockfile.
- core and inbox codegen run against local, documented compatibility schemas.
- generated client files are committed and checked for drift.
- `npm run dev:demo` starts with no secrets or external backend.
- HTTPS setup is explicit.
- Node/npm engines and the package manager are declared.
- CI checks codegen, lint, types, unit tests, runtime audit, and build on the real branches.

## Security review

### Fixed in the candidate

1. **Static path traversal — high.** The custom server joined a decoded request path to the public directory without confinement. Plain, encoded, and backslash traversal are now rejected and unit-tested.
2. **Authentication data in logs — high.** The session and upload runtimes logged OAuth/bearer token previews, full auth results, session objects, endpoint URLs, and token lengths. Token/payload previews were removed, the public debug upload route now logs only a boolean `hasToken`, and a source-level runtime regression test covers both upload paths.
3. **Mail endpoint leakage and abuse surface — medium.** Feedback/newsletter handlers accepted unbounded data and returned/logged provider objects and errors. They now validate methods and input, reject header injection, and return generic failures. Deployment-level rate limiting remains open.
4. **Runtime dependencies — high.** Compatible direct dependencies were updated and unused codegen plugins removed. `npm audit --omit=dev` reports zero known findings at validation time.

### Remaining or operator-owned

- Auth still supports browser token storage. Changing it safely needs a coordinated backend contract and rollout.
- Other contexts contain verbose response/event logging and require a privacy-focused pass.
- The public debug upload route remains available and needs a product/operations decision; its token preview and endpoint logging have been removed.
- The operational Gitea workflow embeds a credential reference in a remote URL, prints remote configuration, and force-pushes. It was not changed without explicit deployment-owner review.
- Secret scanning and push protection are disabled in GitHub settings.
- Current-tree scanning found no high-confidence committed secret value. History includes a former E2E environment file with a credential-looking test value and a localhost certificate key. If the test credential was ever reusable, rotate it; do not rewrite history casually.
- No private vulnerability-reporting channel is currently confirmed.

## Dependency posture

- Runtime audit: 0 findings.
- Full graph: 39 findings (2 critical, 17 high, 12 moderate, 8 low), concentrated in development/build tooling; npm offered no safe automatic fix for most. Treat this as a tracked tooling-upgrade program, not a reason to force incompatible major versions into the candidate.
- Vite 6.4.3 is intentionally pinned to Vinxi 0.5 compatibility. Vite 7 produced a reproducible build failure.
- `npm outdated` still reports reviewable patch/minor updates and breaking major lines such as SolidStart 2, Vite 8, Solid Router 1, GraphQL 17, and Swiper 14. They were not bundled into this readiness change; monthly Dependabot updates keep that work visible and separately testable.

## Validation evidence

| Check | Result |
| --- | --- |
| Clean dependency install without lifecycle scripts | Passed |
| Local core + inbox GraphQL codegen | Passed |
| TypeScript strict check | Passed |
| Biome lint | Passed; generated code excluded |
| Node unit tests | Passed (11) |
| SolidStart/Vinxi production build | Passed |
| Demo fixture HTTP request | 200, HTML returned, no internal-error marker |
| Playwright Chromium demo smoke | Passed |
| Runtime npm audit | 0 known findings |
| GitHub CI (`quality` and `dependency-review`) | Passed on the pull-request candidate |

External API behaviour, authenticated flows, inbox, realtime events, mail delivery, deployed server behaviour, and production deployment are **UNVERIFIABLE** from this audit.

## Highest-value next actions

1. Review pull request #533 and merge only after maintainer approval; its candidate checks are green.
2. Protect `dev`, enable secret scanning/push protection/private vulnerability reporting, and decide the role of `main`.
3. Publish the reviewed issue backlog gradually and label it accurately.
4. Merge only after operational review of `.gitea/workflows/main.yml`; merge, release, and deploy remain separate decisions.
5. After visible maintenance resumes, submit the Codex for Open Source application and publish a real `v0.16.0` release only from a verified release commit.
