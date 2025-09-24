# OAuth Провайдеры: Настройка и Интеграция

## 🔐 Поддерживаемые провайдеры

Проект поддерживает следующие OAuth 2.0 провайдеры:
- **Telegram** (`telegram`)
- **X.com (Twitter)** (`x.com` → `twitter` API)
- **Google** (`google`)
- **GitHub** (`github`)
- **Facebook** (`facebook`)
- **VKontakte** (`vk`)
- **Yandex** (`yandex`)

## 🚀 Frontend интеграция

### **Использование в компонентах**

```typescript
import { useSession } from '~/context/session'

export function SocialProviders() {
  const { oauth } = useSession()
  
  return (
    <div class="social-providers">
      <button onClick={() => oauth('telegram')}>
        Войти через Telegram
      </button>
      <button onClick={() => oauth('x.com')}>
        Войти через X.com
      </button>
      <button onClick={() => oauth('google')}>
        Войти через Google
      </button>
      <button onClick={() => oauth('github')}>
        Войти через GitHub
      </button>
      <button onClick={() => oauth('facebook')}>
        Войти через Facebook
      </button>
      <button onClick={() => oauth('vk')}>
        Войти через VKontakte
      </button>
      <button onClick={() => oauth('yandex')}>
        Войти через Yandex
      </button>
    </div>
  )
}
```

### **Логика авторизации**

1. **Инициация**: `oauth(provider)` генерирует безопасный state и redirects
2. **Callback**: Провайдер возвращает `access_token` и `state`
3. **Валидация**: State проверяется на CSRF защиту и TTL (10 минут)
4. **Сессия**: Токен сохраняется и загружаются данные пользователя

## 🛠️ Backend требования

### **Эндпоинты для реализации**

```
GET /oauth/{provider}
- Инициация OAuth flow
- Редирект на провайдера

GET /oauth/{provider}/callback  
- Обработка callback от провайдера
- Обмен code на access_token
- Создание/обновление пользователя
- Возврат JWT токена
```

### **Провайдеры конфигурации**

#### **1. Telegram OAuth**

```yaml
# Environment Variables
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CLIENT_ID=your_bot_username
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/oauth/telegram/callback

# OAuth Flow
# Используется Telegram Login Widget или Bot API
# https://core.telegram.org/widgets/login
```

**Особенности Telegram:**
- Использует специальный Login Widget
- Данные передаются через hash параметры
- Проверка подписи через bot token

#### **2. X.com (Twitter) OAuth 2.0**

```yaml
# Environment Variables  
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_REDIRECT_URI=https://yourdomain.com/oauth/twitter/callback

# OAuth 2.0 with PKCE
TWITTER_API_URL=https://api.twitter.com/2/oauth2/authorize
TWITTER_TOKEN_URL=https://api.twitter.com/2/oauth2/token
```

**Scopes**: `tweet.read users.read`

#### **3. Google OAuth 2.0**

```yaml
# Environment Variables
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret  
GOOGLE_REDIRECT_URI=https://yourdomain.com/oauth/google/callback

# OAuth URLs
GOOGLE_AUTH_URL=https://accounts.google.com/o/oauth2/v2/auth
GOOGLE_TOKEN_URL=https://oauth2.googleapis.com/token
GOOGLE_USERINFO_URL=https://www.googleapis.com/oauth2/v2/userinfo
```

**Scopes**: `openid profile email`

#### **4. GitHub OAuth**

```yaml
# Environment Variables
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/oauth/github/callback

# OAuth URLs  
GITHUB_AUTH_URL=https://github.com/login/oauth/authorize
GITHUB_TOKEN_URL=https://github.com/login/oauth/access_token
GITHUB_API_URL=https://api.github.com/user
```

**Scopes**: `user:email`

#### **5. Facebook OAuth**

```yaml
# Environment Variables
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_REDIRECT_URI=https://yourdomain.com/oauth/facebook/callback

# OAuth URLs
FACEBOOK_AUTH_URL=https://www.facebook.com/v18.0/dialog/oauth  
FACEBOOK_TOKEN_URL=https://graph.facebook.com/v18.0/oauth/access_token
FACEBOOK_API_URL=https://graph.facebook.com/v18.0/me
```

**Scopes**: `email public_profile`

#### **6. VKontakte OAuth**

```yaml
# Environment Variables
VK_CLIENT_ID=your_app_id
VK_CLIENT_SECRET=your_app_secret
VK_REDIRECT_URI=https://yourdomain.com/oauth/vk/callback

# OAuth URLs
VK_AUTH_URL=https://oauth.vk.com/authorize
VK_TOKEN_URL=https://oauth.vk.com/access_token
VK_API_URL=https://api.vk.com/method/users.get
```

**Scopes**: `email`

#### **7. Yandex OAuth**

```yaml
# Environment Variables
YANDEX_CLIENT_ID=your_client_id
YANDEX_CLIENT_SECRET=your_client_secret
YANDEX_REDIRECT_URI=https://yourdomain.com/oauth/yandex/callback

# OAuth URLs
YANDEX_AUTH_URL=https://oauth.yandex.ru/authorize
YANDEX_TOKEN_URL=https://oauth.yandex.ru/token
YANDEX_API_URL=https://login.yandex.ru/info
```

**Scopes**: `login:email login:info`

# OAuth Providers
TELEGRAM_BOT_TOKEN=...
TWITTER_CLIENT_ID=...
GOOGLE_CLIENT_ID=...
GITHUB_CLIENT_ID=...
FACEBOOK_APP_ID=...
VK_CLIENT_ID=...
YANDEX_CLIENT_ID=...
```

### **Backend требует реализации**
- [ ] Эндпоинты `/oauth/{provider}` и `/oauth/{provider}/callback`
- [ ] Конфигурация всех 7 провайдеров
- [ ] State валидация и TTL проверка  
- [ ] Создание/обновление пользователей
- [ ] JWT токен генерация
- [ ] Обработка ошибок провайдеров

### **Конфигурация провайдеров**
- [ ] Telegram: Bot Token и Login Widget
- [ ] X.com: OAuth 2.0 приложение
- [ ] Google: OAuth 2.0 credentials  
- [ ] GitHub: OAuth Apps настройка
- [ ] Facebook: App ID и permissions
- [ ] VKontakte: App ID и OAuth настройка
- [ ] Yandex: Client ID и OAuth приложение