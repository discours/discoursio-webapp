# Architecture overview

Discoursio Webapp is a server-rendered SolidStart application. The repository combines a public reading interface, author and topic discovery, discussions, account state, a rich editor, drafts, and auxiliary serverless handlers.

## Runtime layers

1. **Routes and SSR** — `src/routes/`, `src/app.tsx`, and Vinxi/SolidStart produce server and browser bundles.
2. **UI** — `src/components/` contains feature-oriented Solid components and SCSS.
3. **State and orchestration** — `src/context/` coordinates sessions, feeds, authors, topics, reactions, drafts, uploads, inbox, and real-time events.
4. **Data contracts** — URQL operations live under `src/graphql/query/` and `src/graphql/mutation/`; generated types live under `src/graphql/generated/`.
5. **Local service handlers** — `src/routes/api/`, `api/`, and `.netlify/functions/` implement media, feedback, and newsletter endpoints for different hosting presets.

## GraphQL boundary

Clean builds use local compatibility schemas in `src/graphql/schema/`. The core snapshot originates in the public Discours backend repository, with narrow additions required by operations already present here. Inbox compatibility comes from this repository's history. See the schema README for provenance and limitations.

Generated types are committed. CI regenerates them and fails on drift. This makes frontend changes reproducible without treating a reachable remote schema as proof of compatibility.

## Rendering and external services

The app renders on the server and hydrates in the browser. Configurable external boundaries include core GraphQL, inbox GraphQL, server-sent events, CDN/media, analytics, error reporting, and a mail provider. Demo mode replaces only the GraphQL read boundary with deterministic empty data; it is not a full backend emulator.

## Security boundaries

- Browser-exposed variables must use the `PUBLIC_` prefix and are never secrets.
- Mail credentials remain server-only.
- Static files are resolved inside the build's public directory and traversal is rejected.
- Auth responses and OAuth tokens must never be logged.
- Local HTTPS setup is an explicit developer action, not a startup side effect.
- Deployment workflow changes require separate operational review; repository CI does not prove deployment.

## Known architectural debt

- Auth tokens are still stored client-side; migration requires a coordinated backend contract.
- Many Playwright scenarios depend on external services and need separation from deterministic tests.
- The `dev` and `main` branches have different histories and need a maintainer-led reconciliation plan.
- Several older documentation pages describe unverified performance or deployment assumptions.
