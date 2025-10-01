# 📚 Documentation of the discours.io frontend

## 🎯 Overview

**Discours.io** is a platform for publishing and discussing content about culture, science and society. The web application is built on modern technologies with an emphasis on performance and user experience.

**Technologies:** SolidJS + TypeScript + GraphQL + SCSS + Lightning CSS

## 📋 Documentation Structure

### 🏗️ [Architecture](architecture/)
- **[Overview](./architecture/overview.md)** — System and technologies
- **[Structure](./architecture/structure.md)** — Code organization
- **[GraphQL plugins](./architecture/graphql-codegen-plugins.md)** — Generation configuration

### ⚡ [Development](development/)
- **[Workflow](./development/workflow.md)** — Development processes
- **[Code standards](./development/standards.md)** — Rules and conventions
- **[Testing](./development/testing.md)** — Quality automation
- **[Deployment](./development/deployment.md)** — Deployment
- **[CI integration](./development/ci-integration.md)** — Automated testing
- **[Contributing](./development/contributing.md)** — Contributor guidelines

### 🎨 [Features](features/)
- **[Overview](./features/overview.md)** — Main capabilities
- **[Authentication](./features/auth.md)** — Registration and OAuth
- **[Editor](./features/editor.md)** — Content creation
- **[Drafts](./features/drafts.md)** — Working with drafts
- **[Feed](./features/feed-components.md)** — Personalized content
- **[Comments](./features/branch-pagination.md)** — Comment system

### 🚀 [Getting Started](getting-started/)
- **[Installation](./getting-started/quick-start.md)** — Project setup

### 🛠️ [Reference](reference/)
- **[Commands](./reference/commands.md)** — NPM scripts
- **[Configuration](./reference/configuration.md)** — Environment variables
- **[Images](./reference/images.md)** — Optimization and caching
- **[Analytics](./reference/analytics.md)** — Metrics and monitoring
- **[Security](./reference/security.md)** — Recommendations

### 🧪 [Testing](testing/)
- **[Use cases](./testing/test-use-cases.md)** — Test scenarios
- **[Automation](./testing/testing.md)** — E2E and integration tests

## 🚀 Quick Start

### Installation
```bash
git clone https://github.com/discours/discoursio-webapp.git
cd discoursio-webapp
npm install
```

### Development
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run typecheck # Type checking
npm run fix      # Auto-fix code style
```

### Testing
```bash
npm run e2e:tests  # E2E tests
npm run test:coverage # Code coverage
```

## 📊 Project Status

**Version:** v0.14.25
**Status:** Active development

## 🤝 Contributing

Please review the [contributing guide](development/contributing.md) before submitting changes.

## 📚 Useful Resources

- [SolidJS Docs](https://www.solidjs.com/docs)
- [GraphQL Guide](https://graphql.org/learn/)
- [Vite Docs](https://vitejs.dev/)
- [Biome Linter](https://biomejs.dev/)
- [Lightning CSS](https://lightningcss.dev/)

---

*Documentation is automatically updated as the project evolves*