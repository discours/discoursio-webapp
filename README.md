# Discours web application

[![CI](https://github.com/discours/discoursio-webapp/actions/workflows/node-ci.yml/badge.svg?branch=dev)](https://github.com/discours/discoursio-webapp/actions/workflows/node-ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The open-source SolidStart web application developed for [Discours](https://discours.io), an independent publishing platform with an open editorial model. Discours has operated since 2015; its wider publishing ecosystem has brought together more than 1,000 authors and contributors and published more than 4,000 works.

This repository contains a substantial production-derived frontend: server-side rendering, a multilingual reader, feeds and profiles, a collaborative rich-text editor, drafts, reactions, threaded discussions, notifications, inbox UI, image handling, and GraphQL clients. It is useful both as a contribution target and as a reference for teams building public-interest publishing infrastructure with SolidJS.

> **Repository status:** `dev` is the contribution branch. The public services configured by this historical application snapshot are not guaranteed to be available. Use the deterministic demo mode for first-run development. The current website may differ from this codebase.

## Quick start

Requirements: Git, Node.js 20.19+ (Node 24 recommended), and npm 10+.

```bash
git clone https://github.com/discours/discoursio-webapp.git
cd discoursio-webapp
npm ci
npm run dev:demo
```

Open `http://localhost:3000`. Demo mode starts a loopback-only, read-only GraphQL fixture and requires no account or secret. It supports the application shell and empty public states; authenticated and write flows require compatible external services.

To connect your own services, copy `.env.example` to `.env`, set the relevant public endpoints, and run `npm run dev`. Local HTTPS is optional and explicit: install `mkcert`, then run `npm run setup:https` once.

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev:demo` | Start the app with deterministic local fixture data |
| `npm run dev` | Start against endpoints configured in `.env` |
| `npm run check` | Lint, type-check, and run unit tests |
| `npm run codegen:check` | Verify committed GraphQL types match local schemas and operations |
| `npm run build` | Create the production SSR build |
| `npm run e2e:install` | Install the optional Playwright Chromium binary |
| `npm run e2e` | Run integration E2E tests against configured services |

The generated GraphQL client is committed so a clean checkout can build offline. The local schemas in `src/graphql/schema/` are compatibility snapshots, not proof of a currently deployed API contract. See their provenance note before changing operations.

## Architecture at a glance

- `src/routes/` — SolidStart file-based routes and server endpoints
- `src/components/` — reader, feed, author, discussion, and editor UI
- `src/context/` — application state and service orchestration
- `src/graphql/` — operations, local schema snapshots, and generated client types
- `api/` and `.netlify/functions/` — feedback, newsletter, and media handlers
- `tests/e2e/` — service-dependent Playwright scenarios
- `tests/unit/` — deterministic Node tests used in CI

The stack is SolidJS/SolidStart, TypeScript, Vinxi/Vite, URQL/GraphQL Code Generator, SCSS/Lightning CSS, Biome, and Playwright.

## Contributing and governance

Start with [CONTRIBUTING.md](CONTRIBUTING.md), the [roadmap](ROADMAP.md), and the [maintainer guide](MAINTAINERS.md). Beginner-friendly and help-wanted issues should state their scope and acceptance criteria. Please report vulnerabilities through [SECURITY.md](SECURITY.md), not a public issue.

Discours is independently maintained. Useful contributions include reliable tests, accessibility fixes, documentation verified against code, and bounded improvements to the editor and public reading experience.

Licensed under the [MIT License](LICENSE).
