import { useSearchParams } from '@solidjs/router'
import { Client } from '@urql/core'
import type { Accessor, JSX } from 'solid-js'
import {
  batch,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
  untrack,
  useContext
} from 'solid-js'
import { isServer } from 'solid-js/web'
import { toast } from 'solid-sonner'
import { useLocalize } from '~/context/localize'
import { type ModalSource } from '~/context/ui'
import { graphqlClientCreate } from '~/graphql/client'
import { Author } from '~/graphql/generated/graphql'
import CancelEmailChangeMutation from '~/graphql/mutation/core/auth-cancel-email-change'
import ConfirmEmailMutation from '~/graphql/mutation/core/auth-confirm-email'
import ConfirmEmailChangeMutation from '~/graphql/mutation/core/auth-confirm-email-change'
import GetSessionMutation from '~/graphql/mutation/core/auth-get-session'
import LoginMutation from '~/graphql/mutation/core/auth-login'
import LogoutMutation from '~/graphql/mutation/core/auth-logout'
import RefreshTokenMutation from '~/graphql/mutation/core/auth-refresh-token'
import RequestPasswordResetMutation from '~/graphql/mutation/core/auth-request-password-reset'
import ResendVerifyEmailMutation from '~/graphql/mutation/core/auth-resend-verify-email'
import ResetPasswordMutation from '~/graphql/mutation/core/auth-reset-password'
import SignupMutation from '~/graphql/mutation/core/auth-signup'
import UpdateProfileMutation from '~/graphql/mutation/core/auth-update-profile'
import UpdateSecurityMutation from '~/graphql/mutation/core/auth-update-security'
import IsEmailUsedQuery from '~/graphql/query/core/auth-is-email-used'
import { coreApiUrl } from '../config'

/**
 * Тестирование подключения к API для отладки
 */
const testApiConnection = async () => {
  try {
    // Простой fetch запрос для проверки доступности
    const response = await fetch(coreApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: '{ __typename }'
      })
    })

    if (!response.ok) {
      console.error('[API Test] API недоступен')
      return false
    }

    await response.json()
    return true
  } catch {
    console.error('[API Test] Ошибка подключения к API')
    return false
  }
}

/**
 * Ключ для хранения токена авторизации в localStorage
 */
export const AUTH_TOKEN_KEY = 'auth-token'

/**
 * Интервал обновления токена в минутах (по умолчанию 30 минут)
 */
const TOKEN_REFRESH_INTERVAL = Number(process.env.TOKEN_REFRESH_INTERVAL) || 30

/**
 * Интерфейс токена авторизации
 */
export type SessionAuthor = Pick<
  Author,
  'bio' | 'email' | 'email_verified' | 'id' | 'links' | 'name' | 'pic' | 'roles' | 'slug' | 'user'
>

export interface AuthPayload {
  token: string
  author: SessionAuthor
}

/**
 * Интерфейс данных входа
 */
export interface LoginInput {
  email: string
  password: string
}

/**
 * Интерфейс данных регистрации
 */
export interface SignupInput {
  email: string
  password: string
  name?: string
}

/**
 * Интерфейс для обновления профиля
 */
export interface UpdateProfileInput {
  name?: string
  email?: string
  bio?: string
  about?: string
  links?: string[]
  pic?: string
  slug?: string
  old_password?: string
  new_password?: string
}

/**
 * Интерфейс для запроса сброса пароля
 */
export interface ForgotPasswordInput {
  email: string
  redirect_url?: string
}

/**
 * Интерфейс для подтверждения email
 */
export interface VerifyEmailInput {
  token: string
}

/**
 * Интерфейс для повторной отправки подтверждения email
 */
export interface ResendVerifyEmailInput {
  email: string
}

/**
 * Тип контекста сессии
 */
type SessionContextType = {
  /** Данные сессии */
  session: Accessor<AuthPayload | undefined>
  /** Флаг загрузки сессии */
  isSessionLoaded: Accessor<boolean>
  /** Флаг валидации сессии */
  isSessionValidating: Accessor<boolean>
  /** Ошибки авторизации */
  authError: Accessor<string>
  /** GraphQL клиент */
  client: Accessor<Client | undefined>
  /** Авторизация пользователя */
  signIn: (params: LoginInput) => Promise<boolean>
  /** Регистрация пользователя */
  signUp: (params: SignupInput) => Promise<boolean>
  /** Обновление профиля */
  updateProfile: (input: UpdateProfileInput) => Promise<boolean>
  /** Выход из системы */
  signOut: () => Promise<boolean>
  /** Требование авторизации */
  requireAuthentication: (callback: (() => Promise<void>) | (() => void), modalSource: ModalSource) => Promise<void>
  /** Обновление токена */
  refreshToken: () => Promise<boolean>
  /** Обновление GraphQL клиента с актуальным токеном */
  refreshClient: () => Promise<void>
  /** Загрузка сессии */
  loadSession: () => Promise<AuthPayload | undefined>
  /** Подтверждение email */
  confirmEmail: (params: VerifyEmailInput) => Promise<boolean>
  /** Повторная отправка подтверждения email */
  resendVerifyEmail: (params: ResendVerifyEmailInput) => Promise<boolean>
  /** Проверка занятости email */
  isEmailUsed: (email: string) => Promise<boolean>
  /** Запрос сброса пароля */
  forgotPassword: (params: ForgotPasswordInput) => Promise<string>
  /** Изменение пароля */
  changePassword: (password: string, token: string) => Promise<boolean>
  /** Проверка регистрации email (алиас для isEmailUsed) */
  isRegistered: (email: string) => Promise<string>
  /** OAuth авторизация */
  oauth: (provider: string) => void
  /** Проверка авторизации */
  isAuthenticated: () => boolean
  /** Подтверждение смены email */
  confirmEmailChange: (token: string) => Promise<boolean>
  /** Отмена смены email */
  cancelEmailChange: () => Promise<boolean>
}

/**
 * Session context to manage authentication state and provide authentication functions.
 */
export const SessionContext = createContext<SessionContextType>({} as SessionContextType)

export function useSession() {
  return useContext(SessionContext)
}

/**
 * SessionProvider component that wraps its children with session context.
 * Реализован согласно принципам fine-grained reactivity из SolidJS документации
 */
export const SessionProvider = (props: {
  onStateChangeCallback(state: AuthPayload | null): unknown
  children: JSX.Element
}) => {
  const { t } = useLocalize()
  const [searchParams, changeSearchParams] = useSearchParams<{
    mode?: string
    m?: string
    token?: string
    source?: string
  }>()

  // Атомарные сигналы для fine-grained reactivity
  const [sessionToken, setSessionToken] = createSignal<string | undefined>()
  const [sessionAuthor, setSessionAuthor] = createSignal<SessionAuthor | undefined>()
  const [isSessionLoaded, setIsSessionLoaded] = createSignal(false)
  // Проверяем наличие токена сразу для корректной инициализации
  const [isSessionValidating, setIsSessionValidating] = createSignal(false)
  const [authError, setAuthError] = createSignal<string>('')
  const [client, setClient] = createSignal<Client>()

  // Session expiration timer
  let sessionTimer: ReturnType<typeof setTimeout> | null = null

  // Производное состояние сессии через createMemo (принцип fine-grained reactivity)
  const session = createMemo(() => {
    const token = sessionToken()
    const author = sessionAuthor()

    if (!token) return undefined

    return { token, author } as AuthPayload
  })

  // Отслеживаем последний токен клиента для оптимизации
  const [lastClientToken, setLastClientToken] = createSignal<string>('')

  // Инициализация GraphQL клиента (принцип атомарности)
  const initializeClient = (token?: string) => {
    const newClient = graphqlClientCreate(coreApiUrl, token)
    setClient(() => newClient)
    setLastClientToken(token || '')
    return newClient
  }

  // Изолированная функция загрузки сессии (принцип изоляции из solid-effects.md)
  const loadSessionData = async (token: string): Promise<AuthPayload | undefined> => {
    try {
      const client = graphqlClientCreate(coreApiUrl, token)

      const result = await client.mutation(GetSessionMutation, {}).toPromise()

      if (result.error) {
        console.error('[loadSessionData] GraphQL request failed')
        return undefined
      }

      if (result.data?.getSession) {
        const { author, token: newToken } = result.data.getSession

        // ✅ Проверяем что author не null перед доступом к свойствам
        if (!author) {
          console.warn('[loadSessionData] Author отсутствует в ответе getSession')
          return undefined
        }

        // Обновляем токен в localStorage если изменился И не пустой
        if (newToken && newToken !== token && !isServer) {
          localStorage.setItem(AUTH_TOKEN_KEY, newToken)
        }

        const sessionData = {
          token: newToken || token, // Используем newToken если есть, иначе исходный token
          author: {
            id: author.id,
            slug: author.slug,
            name: author.name,
            email: author.email,
            email_verified: author.email_verified,
            pic: author.pic,
            bio: author.bio,
            links: author.links,
            roles: author.roles,
            user: author.user
          }
        }

        return sessionData
      }

      console.warn('[loadSessionData] Данные сессии отсутствуют в ответе')
      return undefined
    } catch {
      console.error('[loadSessionData] Session request failed')
      return undefined
    }
  }

  // Функция для загрузки сессии с переданным клиентом (для работы с httpOnly cookies)
  const loadSessionDataWithClient = async (client: Client): Promise<AuthPayload | undefined> => {
    try {
      const result = await client.mutation(GetSessionMutation, {}).toPromise()

      if (result.error) {
        console.error('[loadSessionDataWithClient] GraphQL request failed')
        return undefined
      }

      if (result.data?.getSession) {
        const { author, token } = result.data.getSession

        // ✅ Проверяем что author не null перед доступом к свойствам
        if (!author) {
          return undefined
        }

        if (!token) {
          console.warn('[loadSessionDataWithClient] Токен отсутствует в ответе')
          return undefined
        }

        const sessionData = {
          token,
          author: {
            id: author.id,
            slug: author.slug,
            name: author.name,
            email: author.email,
            email_verified: author.email_verified,
            pic: author.pic,
            bio: author.bio,
            links: author.links,
            roles: author.roles,
            user: author.user
          }
        }

        return sessionData
      }

      console.warn('[loadSessionDataWithClient] Данные сессии отсутствуют в ответе')
      return undefined
    } catch {
      console.error('[loadSessionDataWithClient] Session request failed')
      return undefined
    }
  }

  // Функция для безопасного обновления сессии (принцип batch из solid-effects.md)
  const updateSession = (
    /**
     * @param {AuthPayload | undefined} sessionData Данные сессии
     * @param {boolean} clearValidatingFlag Флаг очистки флага валидации
     * @param {boolean} clearStorage Флаг очистки хранилища
     *
     * @returns {void}
     */
    sessionData: AuthPayload | undefined,
    clearValidatingFlag = true,
    clearStorage = true
  ) => {
    console.log('[updateSession] Обновление сессии:', {
      hasSessionData: !!sessionData,
      clearValidatingFlag
    })
    batch(() => {
      if (sessionData) {
        console.log('[updateSession] Устанавливаем токен и автора')
        setSessionToken(sessionData.token)
        setSessionAuthor(sessionData.author)
        setAuthError('')

        // Обновляем клиент если токен изменился
        if (sessionData.token !== lastClientToken()) {
          console.log('[updateSession] Токен изменился, обновляем клиент')
          initializeClient(sessionData.token)
        }

        // Вызываем callback внутри untrack чтобы избежать циклических зависимостей
        untrack(() => {
          console.log('[updateSession] Вызываем callback с данными сессии')
          props.onStateChangeCallback(sessionData)
        })

        setupSessionTimer()
      } else {
        console.log('[updateSession] Очищаем сессию')
        // Очищаем сессию
        setSessionToken(undefined)
        setSessionAuthor(undefined)
        if (!isServer && clearStorage) {
          localStorage.removeItem(AUTH_TOKEN_KEY)
        }
        initializeClient() // Клиент без токена

        // Вызываем callback для очистки
        untrack(() => {
          console.log('[updateSession] Вызываем callback для очистки')
          props.onStateChangeCallback(null)
        })
      }

      // Сбрасываем флаг валидации только если указано
      if (clearValidatingFlag) {
        console.log('[updateSession] Сбрасываем флаг валидации')
        setIsSessionValidating(false)
      }
      setIsSessionLoaded(true)
      console.log('[updateSession] Сессия обновлена')
    })
  }

  // Главная функция загрузки сессии с правильной обработкой асинхронности
  const loadSession = async (): Promise<AuthPayload | undefined> => {
    // Не загружаем сессию во время SSR (принцип isServer check)
    if (isServer) {
      console.log('[loadSession] SSR detected, skipping session loading')
      return undefined
    }

    console.log('[loadSession] Loading session data')

    const storedToken = isServer ? null : localStorage.getItem(AUTH_TOKEN_KEY)

    if (!storedToken) {
      // Если localStorage пустой, пытаемся восстановить сессию из httpOnly cookie
      console.log('[loadSession] localStorage пустой, пытаемся восстановить из httpOnly cookie')

      try {
        // Создаем клиент без токена - сервер должен проверить httpOnly cookie
        const cookieClient = graphqlClientCreate(coreApiUrl)
        const sessionData = await loadSessionDataWithClient(cookieClient)

        if (sessionData) {
          console.log('[loadSession] Сессия восстановлена из httpOnly cookie')
          // Сохраняем токен в localStorage для последующих запросов
          localStorage.setItem(AUTH_TOKEN_KEY, sessionData.token)
          updateSession(sessionData, true)
          return sessionData
        } else {
          console.log('[loadSession] Не удалось восстановить сессию из cookie')
          updateSession(undefined, true, false)
          return undefined
        }
      } catch {
        console.warn('[loadSession] Ошибка при восстановлении сессии из cookie')
        updateSession(undefined, true, false)
        return undefined
      }
    }

    setIsSessionValidating(true)

    try {
      const sessionData = await loadSessionData(storedToken)
      if (sessionData) {
        updateSession(sessionData)
      } else {
        // Не удаляем токен из localStorage при временных ошибках
        updateSession(undefined, true, false)
      }
      return sessionData
    } catch {
      console.error('[loadSession] Failed to load session')
      setAuthError(t('Failed to load session'))
      // Не удаляем токен из localStorage при исключениях
      updateSession(undefined, true, false)
      return undefined
    }
  }

  // Обработка токена сброса пароля (OAuth теперь обрабатывается в /oauth/callback)
  createEffect(
    on(
      () => searchParams?.token,
      (token) => {
        // Обработка токена сброса пароля
        if (token) {
          console.info('[SessionProvider] Processing password reset token')
          changeSearchParams({ mode: 'change-password', m: 'auth', token }, { replace: true })
        }
      },
      { defer: true }
    )
  )

  // Проверка ошибок OAuth (роут /oauth уже обработал токен)
  createEffect(() => {
    if (!isServer) {
      const urlParams = new URLSearchParams(window.location.search)
      const oauthError = urlParams.get('oauth_error')

      if (oauthError) {
        console.error('[SessionProvider] OAuth provider returned an error')

        const errorMessages = {
          auth_failed: t('OAuth authorization failed'),
          access_denied: t('Access denied by user'),
          invalid_request: t('Invalid OAuth request'),
          server_error: t('OAuth server error'),
          invalid_client: t('Invalid OAuth client'),
          oauth_expired: t('OAuth session expired'),
          oauth_invalid: t('OAuth validation failed')
        }

        const errorMessage = errorMessages[oauthError as keyof typeof errorMessages] || t(`OAuth error: ${oauthError}`)

        toast.error(errorMessage)

        // Очищаем ошибку из URL
        urlParams.delete('oauth_error')
        const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ''}`
        window.history.replaceState({}, '', newUrl)
      }
    }
  })

  // Инициализация сессии при монтировании
  onMount(async () => {
    if (!isServer) {
      // 🔑 ПРИОРИТЕТ: Проверяем OAuth токен в URL (на любом роуте)
      const urlParams = new URLSearchParams(window.location.search)
      const oauthToken = urlParams.get('access_token')
      const oauthError = urlParams.get('oauth_error')

      if (oauthError) {
        console.error('[SessionProvider] OAuth provider returned an error')
        setAuthError(t(`OAuth error: ${oauthError}`))
        // Очищаем URL от ошибки
        urlParams.delete('oauth_error')
        const cleanUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ''}`
        window.history.replaceState({}, '', cleanUrl)
        return
      }

      if (oauthToken) {
        // Сохраняем токен в localStorage
        localStorage.setItem(AUTH_TOKEN_KEY, oauthToken)

        // 🎯 Обрабатываем state для получения redirect URL
        const stateParam = urlParams.get('state')
        let redirectUrl = window.location.pathname // Fallback на текущую страницу

        if (stateParam) {
          try {
            const stateData = JSON.parse(atob(stateParam))
            if (stateData.redirect_url) {
              redirectUrl = new URL(stateData.redirect_url).pathname + new URL(stateData.redirect_url).search
            }
          } catch {
            console.warn('[SessionProvider] Failed to parse OAuth state')
          }
        }

        // Очищаем URL от токена и переходим на redirect URL
        urlParams.delete('access_token')
        urlParams.delete('state')
        const cleanUrl = redirectUrl
        window.history.replaceState({}, '', cleanUrl)

        // Инициализируем клиент с новым токеном
        initializeClient(oauthToken)

        // 🚨 FIX: Загружаем сессию БЕЗ автоматического setupSessionTimer
        try {
          setIsSessionValidating(true)
          const sessionData = await loadSessionData(oauthToken)
          if (sessionData) {
            // Обновляем сессию БЕЗ setupSessionTimer для предотвращения цикла
            batch(() => {
              setSessionToken(sessionData.token)
              setSessionAuthor(sessionData.author)
              setAuthError('')

              if (sessionData.token !== lastClientToken()) {
                initializeClient(sessionData.token)
              }

              untrack(() => props.onStateChangeCallback(sessionData))
              setIsSessionValidating(false)
              setIsSessionLoaded(true)
            })

            // Устанавливаем таймер с задержкой для стабилизации
            setTimeout(() => setupSessionTimer(), 5000)
            console.log('[SessionProvider] ✅ OAuth session loaded successfully')
          } else {
            console.error('[SessionProvider] Failed to load OAuth session')
            updateSession(undefined, true, false)
          }
        } catch {
          console.error('[SessionProvider] OAuth session request failed')
          updateSession(undefined, true, false)
        }
        return
      }

      // Обычная проверка localStorage на токен
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)

      if (storedToken) {
        console.log('[SessionProvider] Token found in localStorage')
        initializeClient(storedToken)
        await loadSession()
      } else {
        console.log('[SessionProvider] No token found')
        initializeClient(undefined)
        updateSession(undefined, true, false)
      }
    }
  })

  // Настройка автоматического обновления токена
  const setupSessionTimer = (intervalMinutes = TOKEN_REFRESH_INTERVAL) => {
    if (sessionTimer) clearTimeout(sessionTimer)

    sessionTimer = setTimeout(
      async () => {
        console.info('[SessionProvider] Auto-refreshing token')

        try {
          const currentSession = untrack(() => session()) // Используем untrack для безопасного чтения

          if (currentSession?.token) {
            const success = await refreshToken()
            if (success) {
              setupSessionTimer(intervalMinutes)
            } else {
              console.warn('[SessionProvider] Token refresh failed, will retry later')
              // 🚨 FIX: НЕ вызываем loadSession в таймере - это создает цикл!
              // Просто перезапускаем таймер с увеличенным интервалом
              setupSessionTimer(Math.max(5, intervalMinutes / 2))
            }
          } else {
            console.warn('[SessionProvider] No session found in timer, will retry later')
            // 🚨 FIX: НЕ вызываем loadSession в таймере - это создает цикл!
            setupSessionTimer(Math.max(5, intervalMinutes / 2))
          }
        } catch {
          console.error('[SessionProvider] Failed to refresh token')
          setupSessionTimer(Math.max(5, intervalMinutes / 2))
        }
      },
      intervalMinutes * 60 * 1000
    )
  }

  onCleanup(() => {
    if (sessionTimer) clearTimeout(sessionTimer)
  })

  /**
   * Авторизация пользователя
   */
  const signIn = async (params: LoginInput): Promise<boolean> => {
    try {
      // Тестируем подключение к API
      if (!isServer) {
        const apiAvailable = await testApiConnection()
        if (!apiAvailable) {
          console.error('[signIn] API недоступен, авторизация невозможна')
          setAuthError('API server is not available')
          return false
        }
      }

      const authClient = graphqlClientCreate(coreApiUrl)
      const result = await authClient
        .mutation(LoginMutation, { email: params.email, password: params.password })
        .toPromise()

      if (result.error) {
        console.error('[signIn] GraphQL request failed')
        setAuthError(result.error.message || 'Sign in failed')
        return false
      }

      if (result.data?.login?.success) {
        const { author, token } = result.data.login

        // ✅ Проверяем что author и token не null
        if (!author || !token) {
          console.error('[signIn] Author или token отсутствуют в ответе login')
          setAuthError('Invalid login response')
          return false
        }

        // Сохраняем токен в localStorage
        if (!isServer) {
          localStorage.setItem(AUTH_TOKEN_KEY, token)
        }

        // Обновляем сессию через batch
        const sessionData: AuthPayload = {
          token,
          author: {
            id: author.id,
            slug: author.slug,
            name: author.name,
            email: author.email,
            email_verified: author.email_verified,
            pic: author.pic,
            bio: author.bio,
            links: author.links,
            roles: author.roles,
            user: author.user
          }
        }

        updateSession(sessionData)
        return true
      }

      console.warn('[signIn] Авторизация не удалась')
      setAuthError(result.data?.login?.error || 'Sign in failed')
      return false
    } catch (error) {
      console.error('[signIn] Authentication request failed')
      setAuthError(error instanceof Error ? error.message : 'Sign in failed')
      return false
    }
  }

  /**
   * Регистрация пользователя
   */
  const signUp = async (params: SignupInput): Promise<boolean> => {
    try {
      console.info('[signUp] Attempting sign up')
      const authClient = graphqlClientCreate(coreApiUrl)

      const result = await authClient
        .mutation(SignupMutation, { email: params.email, password: params.password, name: params.name })
        .toPromise()

      if (result.data?.registerUser?.success) {
        const { author, token } = result.data.registerUser

        // ✅ Проверяем что author и token не null
        if (!author || !token) {
          console.error('[signUp] Author или token отсутствуют в ответе registerUser')
          return false
        }

        // Сохраняем токен в localStorage
        if (!isServer) {
          localStorage.setItem(AUTH_TOKEN_KEY, token)
        }

        // Обновляем сессию через batch
        const sessionData: AuthPayload = {
          token,
          author: {
            id: author.id,
            slug: author.slug,
            name: author.name,
            email: author.email,
            email_verified: author.email_verified,
            pic: author.pic,
            bio: author.bio,
            links: author.links,
            roles: author.roles,
            user: author.user
          }
        }

        updateSession(sessionData)
        return true
      }

      setAuthError(result.data?.registerUser?.error || 'Sign up failed')
      return false
    } catch {
      console.error('[signUp] Registration request failed')
      setAuthError('Sign up failed')
      return false
    }
  }

  /**
   * Выход из системы
   */
  const signOut = async (): Promise<boolean> => {
    try {
      console.info('[signOut] Signing out')

      const currentSession = untrack(() => session())
      let logoutSuccess = false

      if (currentSession?.token) {
        // Пытаемся выполнить logout на сервере с токеном
        try {
          const authClient = graphqlClientCreate(coreApiUrl, currentSession.token)
          await authClient.mutation(LogoutMutation, {}).toPromise()
          logoutSuccess = true
        } catch {
          console.warn('[signOut] Failed to logout with token')
        }
      } else {
        // Если токен недоступен локально, пытаемся выполнить logout через httpOnly cookie
        console.log('[signOut] No local token, trying logout via httpOnly cookie')
        try {
          const cookieClient = graphqlClientCreate(coreApiUrl)
          await cookieClient.mutation(LogoutMutation, {}).toPromise()
          logoutSuccess = true
        } catch {
          console.warn('[signOut] Failed to logout via cookie')
        }
      }

      // Очищаем локальную сессию в любом случае
      updateSession(undefined)

      if (logoutSuccess) {
        toast.success(t("You've successfully logged out"))
      } else {
        toast.success(t('Local session cleared'))
      }

      return true
    } catch {
      console.error('[signOut] Logout request failed')
      // Все равно очищаем локальную сессию
      updateSession(undefined)
      return false
    }
  }

  /**
   * Обновление профиля пользователя
   * Поддерживает смену всех полей профиля, включая email и пароль
   */
  const updateProfile = async (params: UpdateProfileInput): Promise<boolean> => {
    try {
      const currentSession = untrack(() => session())
      if (!currentSession?.token) {
        setAuthError('Not authenticated')
        return false
      }

      console.info('[updateProfile] Updating profile with params:', {
        hasEmail: !!params.email,
        hasOldPassword: !!params.old_password,
        hasNewPassword: !!params.new_password
      })

      const authClient = graphqlClientCreate(coreApiUrl, currentSession.token)

      // Для смены пароля или email используем специальную мутацию безопасности
      if (
        params.old_password ||
        params.new_password ||
        (params.email && params.email !== currentSession.author.email)
      ) {
        const securityUpdateResult = await authClient
          .mutation(UpdateSecurityMutation, {
            email: params.email,
            old_password: params.old_password,
            new_password: params.new_password
          })
          .toPromise()

        if (securityUpdateResult.error) {
          console.error('[updateProfile] Security update request failed')
          throw new Error(securityUpdateResult.error.message)
        }

        if (securityUpdateResult.data?.updateSecurity?.error) {
          console.error('[updateProfile] Security update was rejected')
          throw new Error(securityUpdateResult.data.updateSecurity.error)
        }

        // Если обновление безопасности прошло успешно, перезагружаем сессию
        if (securityUpdateResult.data?.updateSecurity?.success) {
          await loadSession()
          return true
        }
      }

      // Для обычных полей профиля используем стандартную мутацию
      const profileUpdateResult = await authClient
        .mutation(UpdateProfileMutation, {
          profile: {
            name: params.name,
            bio: params.bio,
            about: params.about,
            links: params.links,
            pic: params.pic,
            slug: params.slug
          }
        })
        .toPromise()

      if (profileUpdateResult.error) {
        console.error('[updateProfile] Profile update request failed')
        throw new Error(profileUpdateResult.error.message)
      }

      if (!profileUpdateResult.data?.update_author?.error) {
        // Перезагружаем данные сессии
        await loadSession()
        return true
      }

      setAuthError(profileUpdateResult.data?.update_author?.error || 'Profile update failed')
      return false
    } catch (error) {
      console.error('[updateProfile] Profile update failed')
      setAuthError(error instanceof Error ? error.message : 'Profile update failed')
      return false
    }
  }

  /**
   * Обновление токена авторизации
   */
  const refreshToken = async (): Promise<boolean> => {
    try {
      console.info('[refreshToken] Refreshing token')

      const currentToken = untrack(() => sessionToken()) || (isServer ? null : localStorage.getItem(AUTH_TOKEN_KEY))

      if (!currentToken) {
        console.warn('[refreshToken] No token available for refresh, trying httpOnly cookie')

        // Если токен недоступен, пытаемся обновить сессию через httpOnly cookie
        try {
          const cookieClient = graphqlClientCreate(coreApiUrl)
          const sessionData = await loadSessionDataWithClient(cookieClient)

          if (sessionData) {
            console.log('[refreshToken] Сессия обновлена из httpOnly cookie')
            localStorage.setItem(AUTH_TOKEN_KEY, sessionData.token)
            updateSession(sessionData, true)
            return true
          }
        } catch {
          console.warn('[refreshToken] Не удалось обновить сессию из cookie')
        }

        return false
      }

      const authClient = graphqlClientCreate(coreApiUrl, currentToken)
      const result = await authClient.mutation(RefreshTokenMutation, {}).toPromise()

      if (result.error) {
        console.error('[refreshToken] GraphQL request failed')
        return false
      }

      if (result.data?.refreshToken?.success) {
        const { author, token } = result.data.refreshToken

        // Сохраняем новый токен
        if (!isServer) {
          localStorage.setItem(AUTH_TOKEN_KEY, token)
        }

        // Обновляем сессию
        const sessionData: AuthPayload = {
          token,
          author: {
            id: author.id,
            slug: author.slug,
            name: author.name,
            email: author.email,
            email_verified: author.email_verified,
            pic: author.pic,
            bio: author.bio,
            links: author.links,
            roles: author.roles,
            user: author.user
          }
        }

        updateSession(sessionData)
        return true
      }

      console.error('[refreshToken] Token refresh failed')
      return false
    } catch {
      console.error('[refreshToken] Refresh request failed')
      return false
    }
  }

  /**
   * Требование авторизации
   */
  const requireAuthentication = async (callback: (() => Promise<void>) | (() => void), modalSource: ModalSource) => {
    console.info('[requireAuthentication] Require authentication from', modalSource)

    try {
      // Обеспечим готовность клиента
      const storedToken = isServer ? null : localStorage.getItem(AUTH_TOKEN_KEY)
      if (!client()) {
        initializeClient(storedToken || undefined)
      }

      // Если есть токен в storage и сессия ещё загружается/не загружена — дождёмся
      if (storedToken && (!isSessionLoaded() || isSessionValidating())) {
        console.info('[requireAuthentication] Waiting for session to load...')
        await loadSession()
      }

      const currentSession = untrack(() => session())
      if (currentSession?.token) {
        try {
          await callback()
          return
        } catch (callbackError) {
          console.error('[requireAuthentication] Callback execution failed')
          toast.error(t('Operation failed'))

          // Если была ошибка авторизации, перенаправляем на форму входа
          if (
            callbackError instanceof Error &&
            (callbackError.message.includes('unauthorized') || callbackError.message.includes('unauthenticated'))
          ) {
            updateSession(undefined)
            changeSearchParams({ mode: 'login', m: 'auth' }, { replace: true })
          }
          return
        }
      }

      // Нет валидной сессии и нет токена в storage — проверяем httpOnly cookie
      if (!storedToken) {
        console.info('[requireAuthentication] No token in localStorage, checking httpOnly cookie')

        try {
          const sessionData = await loadSession()
          if (sessionData?.token) {
            console.log('[requireAuthentication] Сессия восстановлена из cookie, выполняем callback')
            await callback()
            return
          }
        } catch {
          console.warn('[requireAuthentication] Не удалось восстановить сессию из cookie')
        }

        // Если cookie тоже не помог, открываем модалку логина
        changeSearchParams({ mode: 'login', m: 'auth' }, { replace: true })
        return
      }

      // Если токен есть, но сессия не подтвердилась — пробуем ещё раз загрузить, затем открыть модалку
      const sessionData = await loadSession()
      if (sessionData?.token) {
        await callback()
        return
      }

      changeSearchParams({ mode: 'login', m: 'auth' }, { replace: true })
    } catch {
      console.error('[requireAuthentication] Unexpected authentication error')
      toast.error(t('Try again later'))
    }
  }

  // Простые вспомогательные функции для других операций
  const changePassword = async (password: string, token: string): Promise<boolean> => {
    try {
      const authClient = graphqlClientCreate(coreApiUrl)
      const result = await authClient.mutation(ResetPasswordMutation, { newPassword: password, token }).toPromise()
      return !!result.data?.resetPassword?.success
    } catch {
      console.error('[changePassword] Password change request failed')
      return false
    }
  }

  const forgotPassword = async (params: ForgotPasswordInput): Promise<string> => {
    try {
      const authClient = graphqlClientCreate(coreApiUrl)
      const result = await authClient.mutation(RequestPasswordResetMutation, { email: params.email }).toPromise()

      if (result.data?.requestPasswordReset?.success) {
        return ''
      }

      return 'Failed to send password reset email'
    } catch {
      console.error('[forgotPassword] Password reset request failed')
      return 'Failed to request password reset'
    }
  }

  /**
   * Подтверждение email адреса
   */
  const confirmEmail = async (params: VerifyEmailInput): Promise<boolean> => {
    try {
      console.info('[confirmEmail] Confirming email with token')
      const authClient = graphqlClientCreate(coreApiUrl)
      const result = await authClient.mutation(ConfirmEmailMutation, { token: params.token }).toPromise()

      if (result.data?.confirmEmail?.success) {
        const { author, token } = result.data.confirmEmail

        // Сохраняем токен если возвращается
        if (token && !isServer) {
          localStorage.setItem(AUTH_TOKEN_KEY, token)
        }

        // Обновляем сессию если возвращается автор
        if (author && token) {
          const sessionData: AuthPayload = {
            token,
            author: {
              id: author.id,
              slug: author.slug,
              name: author.name,
              email: author.email,
              email_verified: author.email_verified,
              pic: author.pic,
              bio: author.bio,
              links: author.links,
              roles: author.roles,
              user: author.user
            }
          }
          updateSession(sessionData)
        }

        return true
      }

      setAuthError(result.data?.confirmEmail?.error || 'Email confirmation failed')
      return false
    } catch {
      console.error('[confirmEmail] Email confirmation request failed')
      setAuthError('Email confirmation failed')
      return false
    }
  }

  /**
   * Повторная отправка подтверждения email
   */
  const resendVerifyEmail = async (params: ResendVerifyEmailInput): Promise<boolean> => {
    try {
      console.info('[resendVerifyEmail] Resending verification email')
      const authClient = graphqlClientCreate(coreApiUrl)
      const result = await authClient.mutation(ResendVerifyEmailMutation, { email: params.email }).toPromise()

      if (result.data?.resendConfirmationEmail?.success) {
        return true
      }

      setAuthError(result.data?.resendConfirmationEmail?.error || 'Failed to resend verification email')
      return false
    } catch {
      console.error('[resendVerifyEmail] Verification email request failed')
      setAuthError('Failed to resend verification email')
      return false
    }
  }

  /**
   * Проверка занятости email адреса (возвращает строку статуса)
   */
  const isRegistered = async (email: string): Promise<string> => {
    try {
      console.info('[isRegistered] Checking email registration status')
      const authClient = graphqlClientCreate(coreApiUrl)
      const result = await authClient.query(IsEmailUsedQuery, { email }).toPromise()

      if (result.error) {
        console.error('[isRegistered] GraphQL request failed')
        return ''
      }

      // Возвращаем статус как строку для совместимости с RegisterForm
      return result.data?.isEmailUsed ? 'registered' : ''
    } catch {
      console.error('[isRegistered] Registration status request failed')
      return ''
    }
  }

  /**
   * OAuth авторизация через внешних провайдеров
   */
  const oauth = (provider: string) => {
    console.info('[oauth] Starting OAuth flow for provider:', provider)

    if (isServer) {
      console.warn('[oauth] OAuth not available during SSR')
      return
    }

    // Валидация провайдера
    const supportedProviders = ['telegram', 'x.com', 'google', 'github', 'facebook', 'vk', 'yandex']
    if (!supportedProviders.includes(provider.toLowerCase())) {
      console.error('[oauth] Unsupported provider:', provider)
      setAuthError(t('Unsupported OAuth provider'))
      return
    }

    try {
      // 🎯 Надежное решение: передаем redirect URL через state параметр
      // Избегаем проблем с ненадежным Referer header
      const currentUrl = window.location.href
      const stateData = {
        uuid: crypto.randomUUID(),
        redirect_url: currentUrl,
        timestamp: Date.now()
      }

      // Кодируем state как base64 для безопасной передачи
      const state = btoa(JSON.stringify(stateData))

      const oauthParams = new URLSearchParams({
        state: state // Передаем текущую страницу через state
      })

      // Обрабатываем специальный случай для x.com (нормализуем до twitter для API)
      const apiProvider = provider.toLowerCase() === 'x.com' ? 'twitter' : provider.toLowerCase()

      const oauthUrl = `${coreApiUrl.replace('/graphql', '')}/oauth/${apiProvider}?${oauthParams.toString()}`

      console.info('[oauth] Redirecting to provider:', apiProvider)

      // Перенаправляем на OAuth провайдера
      window.location.href = oauthUrl
    } catch {
      console.error('[oauth] Error starting OAuth flow')
      setAuthError(t('Failed to initialize OAuth'))
    }
  }

  /**
   * Проверка авторизации пользователя
   */
  const isAuthenticated = (): boolean => {
    const currentSession = session()
    return !!(currentSession?.token && currentSession?.author)
  }

  /**
   * Проверка занятости email адреса (возвращает boolean)
   */
  const isEmailUsed = async (email: string): Promise<boolean> => {
    const result = await isRegistered(email)
    return result === 'registered'
  }

  /**
   * Подтверждение смены email адреса
   */
  const confirmEmailChange = async (token: string): Promise<boolean> => {
    try {
      console.info('[confirmEmailChange] Confirming email change with token')
      const currentSession = untrack(() => session())
      if (!currentSession?.token) {
        setAuthError('Not authenticated')
        return false
      }

      const authClient = graphqlClientCreate(coreApiUrl, currentSession.token)
      const result = await authClient.mutation(ConfirmEmailChangeMutation, { token }).toPromise()

      if (result.error) {
        console.error('[confirmEmailChange] GraphQL request failed')
        setAuthError(result.error.message || 'Email change confirmation failed')
        return false
      }

      if (result.data?.confirmEmailChange?.success) {
        // Перезагружаем сессию для получения обновленного email
        await loadSession()
        return true
      }

      setAuthError(result.data?.confirmEmailChange?.error || 'Email change confirmation failed')
      return false
    } catch {
      console.error('[confirmEmailChange] Email change request failed')
      setAuthError('Email change confirmation failed')
      return false
    }
  }

  /**
   * Отмена смены email адреса
   */
  const cancelEmailChange = async (): Promise<boolean> => {
    try {
      console.info('[cancelEmailChange] Canceling email change')
      const currentSession = untrack(() => session())
      if (!currentSession?.token) {
        setAuthError('Not authenticated')
        return false
      }

      const authClient = graphqlClientCreate(coreApiUrl, currentSession.token)
      const result = await authClient.mutation(CancelEmailChangeMutation, {}).toPromise()

      if (result.error) {
        console.error('[cancelEmailChange] GraphQL request failed')
        setAuthError(result.error.message || 'Email change cancellation failed')
        return false
      }

      if (result.data?.cancelEmailChange?.success) {
        // Перезагружаем сессию для получения актуального состояния
        await loadSession()
        return true
      }

      setAuthError(result.data?.cancelEmailChange?.error || 'Email change cancellation failed')
      return false
    } catch {
      console.error('[cancelEmailChange] Cancellation request failed')
      setAuthError('Email change cancellation failed')
      return false
    }
  }

  /**
   * Принудительное обновление GraphQL клиента с текущим токеном
   * Используется в случаях, когда клиент не был правильно инициализирован
   * @returns Promise, который разрешается, когда клиент обновлен
   */
  const refreshClient = () => {
    return new Promise<void>((resolve) => {
      const currentToken = session()?.token || ''
      console.log('[session] Manually refreshing GraphQL client with token:', !!currentToken)

      // Создаем новый клиент с токеном
      const newClient = graphqlClientCreate(coreApiUrl, currentToken)

      // Обновляем состояние
      setLastClientToken(currentToken)
      setClient(() => newClient)

      // Небольшая задержка для гарантии обновления состояния
      setTimeout(() => {
        if (!client()) {
          console.warn('[session] Client still not available after refresh')
        }
        resolve()
      }, 50)
    })
  }

  const contextValue: SessionContextType = {
    session,
    isSessionLoaded,
    isSessionValidating,
    authError,
    client,
    signIn,
    signUp,
    updateProfile,
    signOut,
    requireAuthentication,
    refreshToken,
    refreshClient,
    loadSession,
    confirmEmail,
    resendVerifyEmail,
    isEmailUsed,
    forgotPassword,
    changePassword,
    isRegistered,
    oauth,
    isAuthenticated,
    confirmEmailChange,
    cancelEmailChange
  }

  return <SessionContext.Provider value={contextValue}>{props.children}</SessionContext.Provider>
}

export const sessionStateChanged = (_payload: AuthPayload | null) => {
  // Session state change callback - можно использовать для дополнительной логики
}
