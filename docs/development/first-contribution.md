# Your first contribution

You can start with a small test without setting up the full web application. Use Git and Node.js 20.19+ (Node 24 is recommended for this repository).

## Run one existing test

```bash
git clone --branch dev https://github.com/discours/discoursio-webapp.git
cd discoursio-webapp
node --test tests/unit/demo-api.test.mjs
```

This focused test uses only Node's built-in modules. It needs no `npm ci`, browser, account, `.env`, or running backend. It checks the empty public data returned by the local demo fixture, not a live publishing service.

Read these two short files together:

- [scripts/demo-api.mjs](../../scripts/demo-api.mjs) creates the fixture data and its HTTP server.
- [tests/unit/demo-api.test.mjs](../../tests/unit/demo-api.test.mjs) checks the data. It does not yet exercise HTTP routing or headers.

For the full application and its checks, follow [CONTRIBUTING.md](../../CONTRIBUTING.md). `npm run e2e:demo` is the account-free browser suite; `npm run e2e` is the separate service-dependent suite.

## Small test-only task

Add HTTP contract tests to the existing `tests/unit/demo-api.test.mjs`. [Issue #553](https://github.com/discours/discoursio-webapp/issues/553) has the scope and acceptance checklist; check its latest comments before starting to avoid duplicating another contributor's work.

Use the real `createDemoApiServer()` on `127.0.0.1` with port `0`, which asks the operating system for a free port. Node's built-in test runner, assertions, and `fetch` are enough; no new dependency is needed.

A finished contribution should verify:

- `POST /graphql` returns 200, JSON content type, and the expected empty public collections.
- `OPTIONS /graphql` returns 204, no response body, and the current CORS headers.
- `GET /graphql` and `POST /unknown` return 404 with the fixture's `Not found` response.
- Test-context cleanup closes the listener even when an assertion fails; repeated runs exit normally without fixed-port conflicts.

Keep these tests in the existing file to keep the fixture's checks together. [PR #552](https://github.com/discours/discoursio-webapp/pull/552) is merged: `npm test` automatically discovers `*.test.mjs` files under `tests/unit/`, including subdirectories. The runner starts in `tests/unit/`, so resolve fixture paths relative to `import.meta.url`, not the working directory.

Test the current behavior without changing the HTTP contract, implementing a GraphQL server, or using live services. If you find a mismatch, describe the reproduction before expanding the fix. Check that a deliberately broken expectation makes the test fail, then remove that temporary break before submitting your PR.

## Before opening a PR

Check for an existing issue or PR covering the same change. If the proposal has an open issue, comment there to coordinate; do not claim or duplicate an existing contributor's work.

Explain what the test catches, list the command you ran and its result, and target `dev`. Follow the repository's [contribution checks](../../CONTRIBUTING.md) for the full validation. Do not include credentials, real user data, copied editorial submissions, or unverified coverage claims.
