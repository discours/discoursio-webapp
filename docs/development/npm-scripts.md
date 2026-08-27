# npm scripts

`package.json` is the source of truth for commands. This page explains the scripts that contributors are expected to use and calls out commands that need external services or modify the local checkout.

The repository requires Node.js 20.19+ and npm 10+. Use the committed npm lockfile:

```bash
npm ci
```

Normal installation has no project lifecycle script that downloads browsers, runs GraphQL code generation, installs certificates, or patches dependencies.

## First run

| Command | Purpose | Requirements |
| --- | --- | --- |
| `npm run dev:demo` | Start the app against a deterministic, loopback-only, read-only fixture | No account or external service |
| `npm run dev` | Start the Vinxi development server against configured endpoints | Compatible services configured in `.env` |
| `npm run setup:https` | Create local development certificates | Optional `mkcert`; explicitly changes the local trust setup |

Use `npm run dev:demo` for the first checkout. The fixture covers the application shell and deterministic public states, not authenticated or write flows.

## Quality gates

| Command | Purpose | Changes files |
| --- | --- | --- |
| `npm run check` | Run lint, TypeScript, and the deterministic unit suite | No |
| `npm run lint` | Run Biome lint checks | No |
| `npm run typecheck` | Run TypeScript without emitting files | No |
| `npm test` | Run the unit suite through `test:unit` | No |
| `npm run test:unit` | Run the explicit Node test files used by CI | No |
| `npm run fix` | Apply Biome lint and formatting fixes | Yes |
| `npm run format` | Apply Biome formatting | Yes |

Review every change produced by `fix` or `format`; neither command is a substitute for `npm run check`.

## GraphQL code generation

| Command | Purpose |
| --- | --- |
| `npm run codegen:check` | Regenerate both clients and fail if committed output drifts |
| `npm run codegen:all` | Regenerate the core and inbox clients |
| `npm run codegen` | Regenerate the core client |
| `npm run codegen:inbox` | Regenerate the inbox client |

Code generation uses the compatibility schemas committed under `src/graphql/schema/`. It is reproducible offline, but it does not prove that a live backend currently exposes the same contract.

## Build and local production server

| Command | Purpose | Notes |
| --- | --- | --- |
| `npm run build` | Create the production SSR build | Main build gate used by CI |
| `npm run build:ci` | Build with CI-compatible Sass settings | Convenience wrapper |
| `npm run build:netlify` | Run both code generators, then build | Builds locally; does not deploy |
| `npm run build:debug` | Build with debug configuration enabled | Diagnostic use only |
| `npm start` | Build through `prestart`, then start the custom production server | Local process; no deployment |
| `npm run start:debug` | Build and start with debug configuration | Diagnostic use only |

`npm start` always invokes `npm run build` first. Use it only when that extra build is intended.

## Playwright

### Deterministic demo

```bash
npm run e2e:install
npm run e2e:demo
```

`e2e:install` downloads the optional Chromium binary. `e2e:demo` runs against the synthetic local fixture and needs no account credentials.

### Service-dependent suites

The following commands require compatible configured services, and some require a dedicated test account. They are not equivalent to the deterministic CI demo:

- `npm run e2e`
- `npm run e2e:test`
- `npm run e2e:smoke`
- `npm run e2e:auth`
- `npm run e2e:ci`
- `npm run e2e:hydration`
- `npm run dev:e2e`
- `npm run test:editor-auth`
- `npm run test:editor-format`
- `npm run test:editor-upload`
- `npm run test:editor-workflow`
- `npm run test:editor-all`

Never use personal or production credentials for these suites.

### Interactive and diagnostic Playwright commands

- `npm run e2e:ui`
- `npm run e2e:ui:smoke`
- `npm run e2e:ui:auth`
- `npm run e2e:debug`
- `npm run e2e:report`

These commands may open a browser or report UI. Authentication requirements still apply to the corresponding scenarios.

## Cleanup and maintenance

| Command | Purpose | Effect |
| --- | --- | --- |
| `npm run e2e:clean` | Remove Playwright result and report directories | Deletes generated test artifacts |
| `npm run clean` | Remove Vinxi and output build artifacts | Deletes generated build artifacts |
| `npm run reset` | Clean, then run `npm install` | Recreates local dependencies; prefer `npm ci` for reproducibility |
| `npm run templates` | Compile the repository's templates | May update generated template output |

## CI-equivalent local sequence

```bash
npm ci --ignore-scripts
npm run codegen:check
npm run check
npm audit --omit=dev
npm run build
```

The runtime audit is a separate command because the full development dependency graph contains historical tooling findings that are not safely auto-fixable.
