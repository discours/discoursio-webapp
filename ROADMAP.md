# Roadmap

This roadmap states direction, not delivery dates. Priorities change with maintainer capacity and the needs of Discours readers, authors, and editors.

## Now: make contribution trustworthy

- Keep clean install, local GraphQL generation, lint, type-check, unit tests, and build green in CI.
- Replace stale documentation with pages verified against the code.
- Establish private vulnerability reporting and review historical credential exposure.
- Triage the existing Playwright suite into deterministic public tests and service-dependent integration tests.
- Improve accessibility incrementally, enabling Biome accessibility rules only with reviewed fixes.

## Next: improve the contributor environment

- Expand demo fixtures from empty states to a small, licensed editorial dataset.
- Add component-level tests for editor, feed, and authentication state transitions.
- Document the live backend compatibility boundary and a supported local integration profile.
- Reduce debug logging and standardise privacy-safe observability.
- Establish a lightweight release and changelog process with signed, reproducible artifacts where practical.

## Later: product and architecture work

- Review token storage and migrate authentication only with a coordinated backend contract.
- Harden feedback and newsletter endpoints with deployment-level rate limiting and abuse controls.
- Modernise the rich editor and collaboration flow through small, test-backed changes.
- Reconcile the historical `dev` and `main` branches and define a single protected release flow.

See the issue backlog prepared in `docs/maintainers/issue-drafts.md` before creating or labelling issues in bulk.
