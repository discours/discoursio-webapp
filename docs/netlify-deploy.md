# 🚀 Деплой на Netlify

## 📋 Подготовка

### 1. Создание аккаунта Netlify
- Зайти на [netlify.com](https://netlify.com)
- Зарегистрироваться через GitHub

### 2. Подключение репозитория
- В Netlify Dashboard: **"Add new site" → "Import an existing project"**
- Выбрать **GitHub** и авторизоваться
- Найти репозиторий `discoursio-webapp`

## ⚙️ Настройка билда

### Build Settings (автоматически из netlify.toml):
```
Build command: npm run build:netlify
Publish directory: .output/public
```

### Environment Variables
Добавить в Netlify Dashboard → Site Settings → Environment Variables:

```bash
# GraphQL
PUBLIC_GRAPHQL_ENDPOINT=https://v3.dscrs.site/graphql
PUBLIC_INBOX_ENDPOINT=https://inbox.dscrs.site

# CDN
PUBLIC_CDN_URL=https://files.dscrs.site

# OAuth (если нужно)
PUBLIC_OAUTH_GITHUB_CLIENT_ID=your_github_client_id
PUBLIC_OAUTH_VK_CLIENT_ID=your_vk_client_id
PUBLIC_OAUTH_GOOGLE_CLIENT_ID=your_google_client_id
PUBLIC_OAUTH_FACEBOOK_CLIENT_ID=your_facebook_client_id

# Email (для API функций)
MAILGUN_API_KEY=your_mailgun_key

# Analytics (опционально)
PUBLIC_GA_IDENTITY=your_ga_id
```

## 🔧 Процесс деплоя

### Автоматический деплой:
1. **Push в main/dev ветку** → автоматический деплой
2. **Pull Request** → preview деплой

### Ручной деплой:
```bash
# Через Netlify CLI (опционально)
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

## 📊 Мониторинг

### Логи билда:
- Netlify Dashboard → Site → Deploys → Build log
- Проверить успешность `npm run codegen:all`
- Проверить генерацию `.output/` директории

### Функции:
- Dashboard → Functions
- Проверить статус: `feedback`, `newsletter`, `og`, `render`

### Тестирование API:
```bash
# Feedback
curl -X POST https://your-site.netlify.app/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"contact":"test@example.com","subject":"Test","message":"Hello"}'

# Newsletter  
curl -X POST https://your-site.netlify.app/api/newsletter \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# OG Image
curl https://your-site.netlify.app/api/og?title=Test
```

## 🚨 Troubleshooting

### Частые проблемы:

1. **GraphQL Codegen timeout**
   ```
   ✅ Решение: Fallback схемы в codegen.ts
   - Основная: https://v3.dscrs.site/graphql  
   - Резерв: https://staging.discours.io/graphql
   - Локальная: ./src/graphql/generated/schema.graphql
   ```

2. **Functions не работают**
   ```
   ✅ Проверить:
   - Environment variables установлены
   - CORS headers в ответах
   - JSON.parse(event.body) для POST запросов
   ```

3. **SSR ошибки**
   ```
   ✅ Проверить:
   - .netlify/functions/render.js существует
   - Redirects настроены в netlify.toml
   - SolidStart совместимость
   ```

## 🎯 Оптимизация

### Кэширование:
- Статические ресурсы: 1 год
- API функции: настроено в headers
- OG изображения: 1 час

### Performance:
- Lightning CSS включен
- Tree shaking активен  
- Code splitting автоматический

## 📝 Полезные команды

```bash
# Локальная разработка с Netlify Dev
netlify dev

# Тестирование функций локально
netlify functions:serve

# Проверка конфигурации
netlify status

# Просмотр логов
netlify logs
```

## 🔗 Полезные ссылки

- [Netlify Docs](https://docs.netlify.com/)
- [SolidStart Netlify Adapter](https://start.solidjs.com/getting-started/deployment#netlify)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
