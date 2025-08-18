# Система аутентификации и управления сессиями

## Обзор

Система аутентификации в проекте использует GraphQL API и контекст сессии для управления состоянием авторизации пользователей. Она обеспечивает следующие функции:

- Аутентификация по email/паролю
- OAuth аутентификация через внешних провайдеров
- Регистрация новых пользователей
- Восстановление и смена пароля
- Управление сессией и ее обновление
- Подтверждение email адреса

## Архитектура

Основные компоненты системы аутентификации:

1. **SessionContext** (`src/context/session.tsx`) - контекст, предоставляющий состояние авторизации и методы для работы с сессией
2. **GraphQL клиент** (`src/graphql/client.ts`) - клиент для работы с GraphQL API
3. **AuthModal** - компонент модального окна авторизации
4. **Мутации для авторизации** - GraphQL мутации для регистрации, входа, выхода и т.д.

## Жизненный цикл сессии

1. **Инициализация**: При загрузке приложения `SessionProvider` пытается восстановить сессию из `localStorage`
2. **Авторизация**: Пользователь может войти через форму входа или OAuth
3. **Обновление**: Сессия автоматически обновляется каждые 30 минут (время настраивается)
4. **Выход**: При выходе, сессия удаляется из `localStorage` и контекста

## 🔐 Решение проблемы с httpOnly cookies

### Проблема
При использовании httpOnly cookies возникает классическая проблема с гидрацией:
- **Сервер устанавливает httpOnly cookie** ✅
- **Клиент не может прочитать httpOnly cookie** ❌ 
- **localStorage пустой** ❌
- **Сессия не восстанавливается при перезагрузке** ❌

### Решение
Система реализует **двухуровневую стратегию восстановления сессии**:

#### 1. **Приоритет localStorage**
```typescript
// Сначала проверяем localStorage
const lsToken = localStorage.getItem(AUTH_TOKEN_KEY)
if (lsToken) {
  initialToken = lsToken
  console.log('[SessionProvider] Токен найден в localStorage')
}
```

#### 2. **Fallback к httpOnly cookies**
```typescript
// Если localStorage пустой, проверяем httpOnly cookies
if (!lsToken) {
  console.log('[SessionProvider] localStorage пустой, проверяем httpOnly cookies')
  
  // Создаем клиент без токена - сервер проверит httpOnly cookie
  const cookieClient = graphqlClientCreate(coreApiUrl)
  
  try {
    // Пытаемся загрузить сессию с пустым токеном
    // Сервер должен проверить httpOnly cookie и вернуть данные
    const sessionData = await loadSessionDataWithClient(cookieClient)
    if (sessionData) {
      console.log('[SessionProvider] Сессия восстановлена из httpOnly cookie')
      // Сохраняем токен в localStorage для последующих запросов
      localStorage.setItem(AUTH_TOKEN_KEY, sessionData.token)
      updateSession(sessionData, true)
      return
    }
  } catch (error) {
    console.log('[SessionProvider] Не удалось восстановить сессию из cookie:', error)
  }
}
```

#### 3. **Функция loadSessionDataWithClient**
```typescript
// Функция для загрузки сессии с переданным клиентом (для работы с httpOnly cookies)
const loadSessionDataWithClient = async (client: Client): Promise<AuthPayload | undefined> => {
  try {
    const result = await client.mutation(GetSessionMutation, {}).toPromise()
    
    if (result.data?.getSession) {
      const { author, token } = result.data.getSession
      
      if (!token) {
        console.warn('[loadSessionDataWithClient] Токен отсутствует в ответе')
        return undefined
      }
      
      return { token, author }
    }
    
    return undefined
  } catch (error) {
    console.error('[loadSessionDataWithClient] Ошибка:', error)
    return undefined
  }
}
```

### 🔄 Обновление всех функций авторизации

#### **loadSession**
```typescript
const loadSession = async (): Promise<AuthPayload | undefined> => {
  const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)
  
  if (!storedToken) {
    // Если localStorage пустой, пытаемся восстановить сессию из httpOnly cookie
    try {
      const cookieClient = graphqlClientCreate(coreApiUrl)
      const sessionData = await loadSessionDataWithClient(cookieClient)
      
      if (sessionData) {
        localStorage.setItem(AUTH_TOKEN_KEY, sessionData.token)
        updateSession(sessionData, true)
        return sessionData
      }
    } catch (error) {
      console.log('[loadSession] Ошибка при восстановлении сессии из cookie:', error)
    }
  }
  
  // Обычная логика загрузки сессии
  // ...
}
```

#### **refreshToken**
```typescript
const refreshToken = async (): Promise<boolean> => {
  const currentToken = sessionToken() || localStorage.getItem(AUTH_TOKEN_KEY)
  
  if (!currentToken) {
    // Если токен недоступен, пытаемся обновить сессию через httpOnly cookie
    try {
      const cookieClient = graphqlClientCreate(coreApiUrl)
      const sessionData = await loadSessionDataWithClient(cookieClient)
      
      if (sessionData) {
        localStorage.setItem(AUTH_TOKEN_KEY, sessionData.token)
        updateSession(sessionData, true)
        return true
      }
    } catch (cookieError) {
      console.log('[refreshToken] Не удалось обновить сессию из cookie:', cookieError)
    }
    
    return false
  }
  
  // Обычная логика обновления токена
  // ...
}
```

#### **requireAuthentication**
```typescript
const requireAuthentication = async (callback: () => Promise<void>, modalSource: string) => {
  const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)
  
  if (!storedToken) {
    // Нет токена в localStorage — проверяем httpOnly cookie
    try {
      const sessionData = await loadSession()
      if (sessionData?.token) {
        await callback()
        return
      }
    } catch (cookieError) {
      console.log('[requireAuthentication] Не удалось восстановить сессию из cookie:', cookieError)
    }
    
    // Если cookie тоже не помог, открываем модалку логина
    changeSearchParams({ mode: 'login', m: 'auth' }, { replace: true })
    return
  }
  
  // Обычная логика проверки авторизации
  // ...
}
```

#### **signOut**
```typescript
const signOut = async (): Promise<boolean> => {
  const currentSession = session()
  let logoutSuccess = false
  
  if (currentSession?.token) {
    // Пытаемся выполнить logout на сервере с токеном
    try {
      const authClient = graphqlClientCreate(coreApiUrl, currentSession.token)
      await authClient.mutation(LogoutMutation, {}).toPromise()
      logoutSuccess = true
    } catch (error) {
      console.warn('[signOut] Failed to logout with token:', error)
    }
  } else {
    // Если токен недоступен локально, пытаемся выполнить logout через httpOnly cookie
    try {
      const cookieClient = graphqlClientCreate(coreApiUrl)
      await cookieClient.mutation(LogoutMutation, {}).toPromise()
      logoutSuccess = true
    } catch (error) {
      console.warn('[signOut] Failed to logout via cookie:', error)
    }
  }
  
  // Очищаем локальную сессию в любом случае
  updateSession(undefined)
  
  return true
}
```

### 🎯 Преимущества решения

1. **🔄 Автоматическое восстановление**: Сессия восстанавливается при перезагрузке страницы
2. **🛡️ Безопасность**: httpOnly cookies защищены от XSS атак
3. **⚡ Производительность**: Токен кешируется в localStorage после первого восстановления
4. **🔄 Fallback стратегия**: Если localStorage недоступен, используется cookie
5. **🧹 Корректная очистка**: Logout работает даже если локальный токен недоступен

### 🔧 Требования к backend

Для корректной работы системы backend должен:

1. **Устанавливать httpOnly cookies** при авторизации
2. **Проверять cookies** в мутации `getSession` даже без токена в заголовке
3. **Возвращать данные пользователя** если cookie валиден
4. **Очищать cookies** при logout

### 📝 Пример backend логики

```python
# Пример для Python/GraphQL
def resolve_get_session(self, info):
    # Сначала проверяем токен в заголовке
    token = info.context.get('token')
    
    if not token:
        # Если токена нет, проверяем httpOnly cookie
        token = info.context.get('cookie_token')
    
    if token:
        # Валидируем токен и возвращаем данные пользователя
        user = validate_token(token)
        if user:
            return {
                'author': user,
                'token': token  # Возвращаем токен для localStorage
            }
    
    return None
```

## Обработка ошибок

Система включает в себя расширенную обработку ошибок:

- Обработка ошибок сетевого подключения
- Обработка ошибок авторизации
- Таймауты для GraphQL запросов
- Умное обновление сессии с адаптивным интервалом при ошибках
- Подробное логирование для диагностики проблем

## Основные методы `session.tsx`

- `signIn(email, password)` - вход по email/паролю
- `signUp(email, password, name)` - регистрация нового пользователя
- `signOut()` - выход из системы
- `oauth(provider)` - инициализация OAuth авторизации
- `forgotPassword(email)` - запрос на восстановление пароля
- `changePassword(password, token)` - изменение пароля
- `updateProfile(profile)` - обновление профиля пользователя
- `requireAuthentication(callback, modalSource)` - проверка авторизации и выполнение действия

## Типизация

В версии 0.10.4 была улучшена типизация в `SessionContext`. Исправлена проблема с `null` vs `undefined` в типе `AuthPayload`, что решило ошибки при проверке типов.

## Безопасность

- Токены хранятся в `localStorage` как `auth_token`
- OAuth состояние отслеживается для предотвращения CSRF атак
- Токены автоматически обновляются
- GraphQL запросы защищены таймаутами для предотвращения зависших запросов
- **httpOnly cookies** для дополнительной защиты от XSS атак

## Примеры использования

### Проверка авторизации

```tsx
const { session } = useSession()

// Проверка наличия сессии
if (session()?.token) {
  // Пользователь авторизован
} else {
  // Пользователь не авторизован
}
```

### Требование авторизации для действия

```tsx
const { requireAuthentication } = useSession()

// Выполнить действие только для авторизованных пользователей
const handleAction = () => {
  requireAuthentication(
    async () => {
      // Действие, требующее авторизации
      await someAction()
    },
    'some-component'
  )
}
```

### Получение данных пользователя

```tsx
const { session } = useSession()

// Получение информации о пользователе
const author = session()?.author
```

## Диагностика проблем

При проблемах с авторизацией следует проверить:

1. Доступность GraphQL API (`coreApiUrl`)
2. Наличие и валидность токена в `localStorage`
3. Консоль на наличие ошибок аутентификации
4. Сетевые запросы в инструментах разработчика
5. Правильную обработку ошибок в функциях авторизации

## Структура GraphQL запросов

Все GraphQL запросы и мутации для аутентификации выделены в отдельные файлы:

### Мутации (`src/graphql/mutation/core/`)

- `auth-login.ts` - Вход в систему 
- `auth-signup.ts` - Регистрация нового пользователя
- `auth-logout.ts` - Выход из системы
- `auth-reset-password.ts` - Сброс пароля
- `auth-request-password-reset.ts` - Запрос на сброс пароля
- `auth-resend-verify-email.ts` - Повторная отправка письма с подтверждением
- `auth-confirm-email.ts` - Подтверждение email
- `auth-update-profile.ts` - Обновление профиля пользователя

### Запросы (`src/graphql/query/core/`)

- `auth-get-session.ts` - Получение сессии пользователя
- `auth-is-email-used.ts` - Проверка, используется ли email

Структура файлов соответствует общему подходу к организации GraphQL запросов в проекте и обеспечивает удобство поддержки и масштабирования.

## Последние изменения

В версии 0.10.4 были внесены следующие улучшения:

- Улучшена обработка ошибок в GraphQL запросах
- Добавлен таймаут для предотвращения зависших запросов
- Реализован адаптивный интервал обновления сессии с учетом ошибок
- Исправлены проблемы типизации в контексте сессии
- Добавлено подробное логирование для диагностики проблем авторизации
- Улучшена обработка OAuth авторизации с сохранением состояния 