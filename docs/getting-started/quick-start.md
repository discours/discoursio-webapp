# Quick start

## Prerequisites

- Git
- Node.js 20.19 or newer; Node 24 is used in CI
- npm 10 or newer

## Deterministic local demo

```bash
git clone https://github.com/discours/discoursio-webapp.git
cd discoursio-webapp
npm ci
npm run dev:demo
```

Open `http://localhost:3000`. This starts a read-only fixture API on the loopback interface. It is suitable for the application shell, public routes, empty states, and frontend work that does not require real content. It does not emulate authentication, writing, inbox, uploads, notifications, or production data.

## Development with compatible services

Copy `.env.example` to `.env`, configure only services you are authorised to use, then run:

```bash
npm run dev
```

The endpoints bundled as fallbacks in this historical snapshot may be unavailable or incompatible. A successful build proves frontend consistency, not live backend compatibility.

Local HTTPS is optional. Install `mkcert` yourself and run `npm run setup:https`; normal startup never installs software or modifies your trust store.

## Verify a change

```bash
npm run codegen:check
npm run check
npm run build
```

For service-dependent Playwright scenarios:

```bash
npm run e2e:install
npm run e2e
```

Authenticated tests require `TEST_USERNAME` and `TEST_PASSWORD` for a dedicated test account. Do not use a personal or production account and never commit the values.

## Common problems

- **Port already in use:** set `PORT` in `.env` or stop the other local process.
- **Generated client differs:** run `npm run codegen:all`, review the schema/operation change, and commit the generated output.
- **External API fails:** reproduce in `npm run dev:demo` first, then verify the configured service separately.
- **Playwright browser missing:** run `npm run e2e:install`; browser installation is never a package lifecycle side effect.
