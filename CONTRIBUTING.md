# Contributing

Thank you for helping improve independent publishing infrastructure. Contributions of code, tests, documentation, accessibility work, and reproducible bug reports are welcome.

## Before you start

- Search existing issues and pull requests. For a large or product-changing proposal, open a discussion issue before implementation.
- Use `dev` as the base branch. `main` is not the active contribution branch in this repository.
- Never include credentials, private content, production data, or real user records in an issue, test, fixture, log, or commit.
- Keep the change bounded. Backend contracts, deployment configuration, and product behaviour may require maintainer confirmation.

## Local setup

```bash
npm ci
npm run dev:demo
```

Demo mode is intentionally read-only and does not represent authentication, publishing, inbox, or other service integrations. For integration work, copy `.env.example` to `.env` and configure services you are authorised to use.

Before opening a pull request:

```bash
npm run codegen:check
npm run check
npm run build
```

Playwright scenarios are optional unless your change affects their feature area. They require Chromium and, for authenticated tests, explicit test-only credentials:

```bash
npm run e2e:install
npm run e2e
```

## GraphQL changes

The local schemas under `src/graphql/schema/` make clean builds reproducible. They are compatibility snapshots, not an assertion about a live deployment. Read `src/graphql/schema/README.md`, change the narrowest schema or operation possible, run `npm run codegen:all`, and commit the generated client changes with the source change.

## Pull requests

A good pull request:

- explains the user-visible or maintainer-visible outcome;
- links an issue when one exists;
- includes focused tests or explains why a test is not practical;
- notes manual verification and external-service assumptions;
- avoids unrelated formatting and generated-file churn;
- updates documentation when commands, configuration, or behaviour changes.

AI-assisted contributions are welcome, but the contributor remains responsible for understanding the change, reviewing the diff, running the checks, and answering review questions.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Security reports follow [SECURITY.md](SECURITY.md).
