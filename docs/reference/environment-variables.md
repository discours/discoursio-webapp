# Environment variables

Copy `.env.example` to `.env` for local configuration. `.env` files are ignored. Never commit credentials or use production accounts in tests.

## Browser-visible configuration

These variables are bundled into client code and cannot contain secrets:

- `PUBLIC_BASE_URL` — canonical application URL
- `PUBLIC_CORE_API` — core GraphQL endpoint
- `PUBLIC_INBOX_API` — inbox GraphQL endpoint
- `PUBLIC_REALTIME_EVENTS` — server-sent-events endpoint
- `PUBLIC_CDN_URL` — media base URL
- `PUBLIC_GA_IDENTITY` — analytics property identifier
- `PUBLIC_GLITCHTIP_DSN` — browser error-reporting DSN
- `PUBLIC_TOKEN_REFRESH_INTERVAL` — session refresh interval in minutes; defaults to `30`

The code contains historical public fallbacks for several endpoints. Their presence does not prove availability. `npm run dev:demo` overrides the GraphQL endpoints locally and needs no `.env` file.

## Server-only configuration

- `MAILGUN_API_KEY` — mail provider credential for feedback and newsletter handlers
- `PORT` and `HOST` — local/server listener
- `LOCAL_HTTPS` — use existing local certificate files when set to `true`

Do not prefix secrets with `PUBLIC_`.

## Development and tests

- `GRAPHQL_SCHEMA_URL` — optional core codegen schema override; local schema is the default
- `INBOX_GRAPHQL_SCHEMA_URL` — optional inbox codegen schema override
- `E2E_BASE_URL` — target URL for service-dependent Playwright tests
- `TEST_USERNAME` and `TEST_PASSWORD` — dedicated test-account credentials; both are required for authenticated tests
- `CI` — enables CI-specific Playwright behaviour

The presence of a variable should be checked without printing its value. Error output, process listings, fixtures, screenshots, and traces must also remain free of credentials and private data.
