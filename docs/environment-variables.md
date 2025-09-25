# 🔧 Environment Variables

## 📋 Полный список используемых переменных окружения

### 🌐 **PUBLIC переменные (доступны в браузере)**

#### **API Endpoints**
```bash
PUBLIC_CDN_URL=https://files.dscrs.site          # CDN для статических файлов
PUBLIC_CORE_API=https://v3.dscrs.site/graphql    # Основной GraphQL API
PUBLIC_INBOX_API=https://inbox.dscrs.site        # Inbox API для чатов
PUBLIC_REALTIME_EVENTS=https://connect.dscrs.site # SSE для real-time событий
```

#### **Analytics & Monitoring**
```bash
PUBLIC_GA_IDENTITY=G-LQ4B87H8C2                 # Google Analytics ID
PUBLIC_GLITCHTIP_DSN=https://...                 # Error reporting (dev only)
```

#### **Base URL (автоматически определяется)**
```bash
PUBLIC_BASE_URL=https://discours.io              # Fallback base URL
VERCEL_PROJECT_PRODUCTION_URL=discours.io        # Vercel production URL
VERCEL_URL=preview-branch.vercel.app             # Vercel preview URL
```

### 🔒 **PRIVATE переменные (только на сервере)**

#### **Email (Mailgun)**
```bash
MAILGUN_API_KEY=key-xxxxxxxxxxxxx               # Для feedback и newsletter
```

#### **System**
```bash
NODE_ENV=production                              # Environment mode
TOKEN_REFRESH_INTERVAL=30                       # Интервал обновления токенов (минуты)
```

#### **CI/CD**
```bash
CI=true                                          # CI environment flag
GITHUB_ACTIONS=true                             # GitHub Actions flag
VERCEL=1                                        # Vercel environment flag
VERCEL_ENV=production                           # Vercel environment type
NETLIFY=true                                    # Netlify environment flag
```

#### **Testing**
```bash
E2E_BASE_URL=https://localhost:3000             # Base URL для E2E тестов
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1              # Пропуск загрузки браузеров
```

## 🏗️ **Использование по файлам**

### **src/config.ts** - Основная конфигурация
- `PUBLIC_CDN_URL` - CDN для файлов
- `PUBLIC_CORE_API` - GraphQL API
- `PUBLIC_INBOX_API` - Inbox API
- `PUBLIC_REALTIME_EVENTS` - SSE события
- `PUBLIC_GA_IDENTITY` - Google Analytics
- `PUBLIC_BASE_URL` - Base URL
- `VERCEL_PROJECT_PRODUCTION_URL` - Vercel production
- `VERCEL_URL` - Vercel preview
- `PUBLIC_GLITCHTIP_DSN` - Error reporting

### **api/*.js** - API функции
- `PUBLIC_CDN_URL` - для OG изображений
- `MAILGUN_API_KEY` - для email отправки

### **src/context/session.tsx** - Авторизация
- `TOKEN_REFRESH_INTERVAL` - интервал обновления токенов

### **Тестирование**
- `CI` - флаг CI окружения
- `E2E_BASE_URL` - URL для тестов
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` - оптимизация CI

### **Build системы**
- `NODE_ENV` - режим сборки
- `VERCEL` / `NETLIFY` - определение платформы
- `GITHUB_ACTIONS` - GitHub CI

## 🚀 **Настройка для деплоя**

```
# Для email функций
MAILGUN_API_KEY=key-xxxxxxxxxxxxx
```

## 🔍 **Автоматическое определение**

Приложение автоматически определяет:
- **Платформу**: Vercel, Netlify, или локальная разработка
- **Base URL**: из VERCEL_URL, VERCEL_PROJECT_PRODUCTION_URL или fallback
- **CI режим**: из CI, GITHUB_ACTIONS флагов
- **Environment**: production, preview, development
