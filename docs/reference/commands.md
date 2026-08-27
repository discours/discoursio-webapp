# Command reference

This is the short command map for contributors. See [npm scripts](../development/npm-scripts.md) for requirements, side effects, and the complete Playwright classification. `package.json` remains the source of truth.

## Common workflows

| Goal | Commands | External requirements |
| --- | --- | --- |
| First local checkout | `npm ci`, then `npm run dev:demo` | None |
| Develop against configured services | `npm ci`, then `npm run dev` | Compatible endpoints in `.env` |
| Verify a normal change | `npm run codegen:check`, `npm run check`, `npm run build` | None |
| Run deterministic browser smoke | `npm run e2e:install`, then `npm run e2e:demo` | Chromium download; no account |
| Start the production build locally | `npm start` | Builds first through `prestart` |

## Read-only checks

| Command | Checks |
| --- | --- |
| `npm run codegen:check` | GraphQL generated-client drift |
| `npm run check` | Biome, TypeScript, and unit tests |
| `npm run lint` | Biome lint rules |
| `npm run typecheck` | TypeScript types |
| `npm test` | Deterministic Node unit tests |
| `npm run build` | Production SSR build |

## Commands that modify the checkout

| Command | Effect |
| --- | --- |
| `npm run codegen:all` | Rewrites generated GraphQL clients |
| `npm run fix` | Applies Biome fixes and formatting |
| `npm run format` | Applies Biome formatting |
| `npm run clean` | Deletes generated build directories |
| `npm run reset` | Cleans and reinstalls dependencies |
| `npm run e2e:clean` | Deletes generated Playwright results |

Review resulting diffs before committing them.

## Service-dependent testing

`npm run e2e`, `npm run e2e:smoke`, `npm run e2e:auth`, and the `test:editor-*` scripts require compatible services; authenticated scenarios also require a dedicated test account. They should fail fast when prerequisites are missing and must never use personal or production credentials.

Use `npm run e2e:demo` when a deterministic, account-free browser check is required.

## Optional local setup

- `npm run e2e:install` downloads Chromium for Playwright.
- `npm run setup:https` uses `mkcert` and explicitly changes local certificate/trust configuration.
- `npm run e2e:ui` and `npm run e2e:debug` open interactive Playwright tooling.

No npm command in this repository publishes a release or deploys production by itself.
