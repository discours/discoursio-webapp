# Discoursio Webapp

## Technology Stack

- [TypeScript](https://www.typescriptlang.org/)
- [SolidJS](https://www.solidjs.com/)
- [Vinxi](https://vinxi.vercel.app/)
- [SCSS](https://sass-lang.com/)
- [URQL](https://formidable.com/open-source/urql/)
- [i18next](https://www.i18next.com/)
- [Tiptap](https://tiptap.dev/)
- [Playwright](https://playwright.dev/)
- [Stylelint](https://stylelint.io/)
- [Biome](https://biomejs.dev/)

## Development

### How to start

1. Clone the repository
2. Install dependencies: `bun i` (or npm/pnpm/yarn)
3. Create a `.env` file (variables with `PUBLIC_` are used in `/src/utils/config.ts`)

### Main commands

```bash
bun run dev         # Start development server
bun run build       # Build for production
bun run typecheck   # Type checking
bun run fix         # Fix styles and linting
bun run storybook   # Start Storybook
```

## Testing

### E2E tests (Playwright)

```bash
bun run e2e:install  # Install E2E dependencies
bun run e2e:tests    # Run tests
bun run e2e:tests:ci # Run tests in CI
```

## CI/CD

Tests are executed in GitHub Actions. Make sure `BASE_URL` is correctly configured in CI.

## Version: 0.9.7
