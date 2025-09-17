# 🌟 Discours Webapp

![Version](https://img.shields.io/badge/version-0.12.0-blue.svg?style=flat)
![Tests](https://img.shields.io/badge/Tests-12_specs-28a745?style=flat&logo=playwright)
![Docs](https://img.shields.io/badge/Docs-29_files-6f42c1?style=flat&logo=markdown)
![Lines](https://img.shields.io/badge/Lines-45K+-informational?style=flat)
![Files](https://img.shields.io/badge/Files-593-informational?style=flat) 
![Components](https://img.shields.io/badge/Components-120+-success?style=flat)
![MIT](https://img.shields.io/badge/License-MIT-green?style=flat)

**Modern web interface** for the Discours platform — an open journal about culture, science and society.

## 📋 Table of Contents

- [🚀 Technology Stack](#-technology-stack)
- [🛠️ Development](#️-development)
  - [📦 Environment Setup](#-environment-setup)
  - [🔐 HTTPS Configuration](#-https-configuration-for-local-development)
  - [⚡ Main Commands](#-main-commands)
- [📚 Documentation](#-documentation)
- [🤝 Contributing](#-contributing)

## 🚀 Technology Stack

![SolidJS](https://img.shields.io/badge/Frontend-SolidJS-2c4f7c?style=flat&logo=solid)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178c6?style=flat&logo=typescript)
![SCSS](https://img.shields.io/badge/Styles-SCSS-cf649a?style=flat&logo=sass)
![SSR](https://img.shields.io/badge/SSR-SolidStart-2c4f7c?style=flat)
![Responsive](https://img.shields.io/badge/Responsive-Mobile_First-success?style=flat)
![URQL](https://img.shields.io/badge/GraphQL-URQL-e10098?style=flat&logo=graphql)
![CodeGen](https://img.shields.io/badge/Codegen-GraphQL-e10098?style=flat)
![i18next](https://img.shields.io/badge/Languages-RU/EN-orange?style=flat)
![Vinxi](https://img.shields.io/badge/Build-Vinxi-orange?style=flat)
![Vite](https://img.shields.io/badge/Bundler-Vite-646cff?style=flat&logo=vite)
![Biome](https://img.shields.io/badge/Linter-Biome-60a5fa?style=flat)

## 🛠️ Development

### 📦 Environment Setup

```shell
# Clone the repository
git clone https://github.com/discours/discoursio-webapp.git
cd discoursio-webapp

# Install dependencies
npm install  # or bun/pnpm/yarn

# Configure environment variables
cp .env.example .env
```

### 🔐 HTTPS Configuration for Local Development

```shell
# Install mkcert (Ubuntu/Debian)
sudo apt install libnss3-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert

# Create local CA
mkcert -install

# Start development server
npm run dev  # or bun dev
```

### ⚡ Main Commands

```bash
# Development
npm run dev         # 🚀 Start development server
npm run build       # 📦 Build for production
npm run preview     # 👀 Preview build

# Code Quality
npm run typecheck   # 🔍 TypeScript type checking
npm run lint        # 🧹 Code linting
npm run fix         # 🔧 Auto-fix styles
npm run format      # 💅 Code formatting

# Additional
npm run storybook   # 📚 Start Storybook
npm run analyze     # 📊 Bundle analysis
```

## 📚 Documentation

![API Docs](https://img.shields.io/badge/API_Docs-GraphQL-ff6b6b?style=flat)
![Coverage Docs](https://img.shields.io/badge/Coverage-95%25-brightgreen?style=flat)

### 📖 Essential

- 📋 **[Main Documentation](docs/README.md)** — Overview of all features
- 🧪 **[Testing](docs/testing.md)** — Quality control automation guide
- 🎨 **[Open Graph System](docs/open-graph.md)** — Meta tags and social networks  
- 🏗️ **[Architecture](docs/architecture.md)** — Structure and patterns
- 🔌 **[API Functions](docs/api-functions.md)** — Server functions
- 🖼️ **[Image System](docs/image-caching.md)** — Caching and optimization

---

## 🤝 Contributing

![Contributing](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat)

**We welcome contributions!** Please read the [contributing guide](docs/contributing.md) before submitting a PR.

---

**Made with ❤️ by the Discours team**

![Made with Love](https://img.shields.io/badge/Made%20with-❤️-red?style=flat)
![Open Source](https://img.shields.io/badge/Open-Source-blue?style=flat)
