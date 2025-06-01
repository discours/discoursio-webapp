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
import toast from 'solid-toast'
import { useLocalize } from '~/context/localize'
import { type ModalSource } from '~/context/ui'
import { graphqlClientCreate } from '~/graphql/client'
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
import { Author } from '~/graphql/schema/core.gen'
import { coreApiUrl } from '../config'

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
export interface AuthPayload {
  token: string
  author: Author
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
  requireAuthentication: (
    callback: (() => Promise<void>) | (() => void),
    modalSource: ModalSource
  ) => Promise<void>
  /** Обновление токена */
  refreshToken: () => Promise<boolean>
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
    state?: string
    redirectURL?: string
    redirect_uri?: string
    token?: string
    access_token?: string
    scope?: string
  }>()

  // Атомарные сигналы для fine-grained reactivity
  const [sessionToken, setSessionToken] = createSignal<string | undefined>()
  const [sessionAuthor, setSessionAuthor] = createSignal<Author | undefined>()
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
        console.error('[loadSessionData] GraphQL error:', result.error)
        return undefined
      }

      if (result.data?.getSession) {
        const { author, token: newToken } = result.data.getSession

        // Обновляем токен в localStorage если изменился И не пустой
        if (newToken && newToken !== token && !isServer) {
          localStorage.setItem(AUTH_TOKEN_KEY, newToken)
        }

        return {
          token: newToken || token, // Используем newToken если есть, иначе исходный token
          author: {
            id: author.id,
            slug: author.slug,
            name: author.name,
            email: author.email,
            pic: author.pic,
            bio: author.bio,
            links: author.links
          }
        }
      }

      return undefined
    } catch (error) {
      console.error('[loadSessionData] Error:', error)
      return undefined
    }
  }

  // Функция для безопасного обновления сессии (принцип batch из solid-effects.md)
  const updateSession = (sessionData: AuthPayload | undefined, clearValidatingFlag = true) => {
    batch(() => {
      if (sessionData) {
        setSessionToken(sessionData.token)
        setSessionAuthor(sessionData.author)
        setAuthError('')

        // Обновляем клиент если токен изменился
        if (sessionData.token !== lastClientToken()) {
          initializeClient(sessionData.token)
        }

        // Вызываем callback внутри untrack чтобы избежать циклических зависимостей
        untrack(() => {
          props.onStateChangeCallback(sessionData)
        })

        setupSessionTimer()
      } else {
        // Очищаем сессию
        setSessionToken(undefined)
        setSessionAuthor(undefined)
        if (!isServer) {
          localStorage.removeItem(AUTH_TOKEN_KEY)
        }
        initializeClient() // Клиент без токена

        // Вызываем callback для очистки
        untrack(() => {
          props.onStateChangeCallback(null)
        })
      }

      // Сбрасываем флаг валидации только если указано
      if (clearValidatingFlag) {
        setIsSessionValidating(false)
      }
      setIsSessionLoaded(true)
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

    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!storedToken) {
      updateSession(undefined)
      return undefined
    }

    setIsSessionValidating(true)

    try {
      const sessionData = await loadSessionData(storedToken)
      updateSession(sessionData)
      return sessionData
    } catch (error) {
      console.error('[loadSession] Failed to load session:', error)
      setAuthError(t('Failed to load session'))
      updateSession(undefined)
      return undefined
    }
  }

  // Обработка OAuth параметров (эффект с defer для предотвращения каскадных обновлений)
  createEffect(
    on(
      [() => searchParams?.state, () => searchParams?.access_token, () => searchParams?.token],
      ([state, access_token, token]) => {
        // OAuth обработка
        if (state && access_token) {
          console.info('[SessionProvider] Processing OAuth callback')

          try {
            const storedStateData = isServer ? null : localStorage.getItem('oauth_state')

            if (!storedStateData) {
              console.warn('[SessionProvider] No stored OAuth state found')
              setAuthError('OAuth session expired')
              changeSearchParams({ error: 'oauth_expired' }, { replace: true })
              return
            }

            // Парсим сохраненное состояние OAuth с типизацией
            interface OAuthState {
              state: string
              provider?: string
              timestamp?: number
              redirectUri?: string
            }

            let oauthState: OAuthState
            try {
              oauthState = JSON.parse(storedStateData) as OAuthState
            } catch (_parseError) {
              console.warn('[SessionProvider] Invalid OAuth state format, using legacy format')
              // Обратная совместимость со старым форматом (просто строка)
              oauthState = { state: storedStateData }
            }

            // Проверяем state
            if (oauthState.state !== state) {
              console.warn('[SessionProvider] OAuth state mismatch:', {
                stored: `${oauthState.state?.substring(0, 8)}...`,
                received: `${state?.substring(0, 8)}...`
              })
              setAuthError('OAuth security validation failed')
              changeSearchParams({ error: 'oauth_invalid' }, { replace: true })
              return
            }

            // Проверяем TTL (10 минут)
            if (oauthState.timestamp) {
              const now = Date.now()
              const stateAge = now - oauthState.timestamp
              const maxAge = 10 * 60 * 1000 // 10 минут

              if (stateAge > maxAge) {
                console.warn('[SessionProvider] OAuth state expired:', {
                  age: Math.round(stateAge / 1000),
                  maxAge: Math.round(maxAge / 1000)
                })
                setAuthError('OAuth session expired')
                changeSearchParams({ error: 'oauth_expired' }, { replace: true })
                if (!isServer) localStorage.removeItem('oauth_state')
                return
              }
            }

            console.info('[SessionProvider] OAuth state verified successfully')

            batch(() => {
              // Сохраняем access_token для дальнейшей обработки
              if (!isServer) {
                localStorage.setItem(AUTH_TOKEN_KEY, access_token)
              }

              // Устанавливаем временную сессию
              setSessionToken(access_token)
              setIsSessionValidating(true)

              // Переходим к подтверждению email или завершению авторизации
              changeSearchParams({ mode: 'confirm-email', m: 'auth' }, { replace: true })

              // Очищаем OAuth state
              if (!isServer) localStorage.removeItem('oauth_state')
            })

            // Асинхронно загружаем данные пользователя
            loadSessionData(access_token)
              .then((sessionData) => {
                if (sessionData) {
                  updateSession(sessionData)
                  toast.success(t('Successfully logged in'))
                } else {
                  console.error('[SessionProvider] Failed to load user data after OAuth')
                  setAuthError('Failed to complete OAuth login')
                  updateSession(undefined)
                }
              })
              .catch((error) => {
                console.error('[SessionProvider] Error loading OAuth user data:', error)
                setAuthError('Failed to complete OAuth login')
                updateSession(undefined)
              })

            return
          } catch (error) {
            console.error('[SessionProvider] Error processing OAuth callback:', error)
            setAuthError('OAuth login failed')
            changeSearchParams({ error: 'oauth_failed' }, { replace: true })
            return
          }
        }

        // Обработка токена сброса пароля
        if (token) {
          console.info('[SessionProvider] Processing password reset token')
          changeSearchParams({ mode: 'change-password', m: 'auth', token }, { replace: true })
        }
      },
      { defer: true }
    )
  )

  // Инициализация сессии при монтировании (используем defer для стабильности)
  onMount(async () => {
    // Инициализируем базовый клиент
    initializeClient()

    // Проверяем наличие токена
    const storedToken = isServer ? null : localStorage.getItem(AUTH_TOKEN_KEY)

    if (storedToken) {
      // Устанавливаем флаг валидации только когда действительно есть токен
      setIsSessionValidating(true)

      // Асинхронно загружаем полные данные сессии
      try {
        const sessionData = await loadSessionData(storedToken)
        updateSession(sessionData, true) // Сбрасываем флаг валидации после загрузки
      } catch (error) {
        console.error('[SessionProvider] Error during session initialization:', error)
        updateSession(undefined, true)
      }
    } else {
      updateSession(undefined, true)
    }
  })

  // Обработка OAuth состояния при монтировании
  createEffect(
    on(
      () => searchParams?.state,
      (state) => {
        if (state) {
          const scope = searchParams?.scope?.toString().split(' ') || ['openid', 'profile', 'email']
          console.info('[SessionProvider] OAuth scope:', scope)
          changeSearchParams({ mode: 'confirm-email', m: 'auth' }, { replace: true })
        }
      },
      { defer: true }
    )
  )

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
              console.warn('[SessionProvider] Token refresh failed, attempting reload')
              await loadSession()
              setupSessionTimer(Math.max(5, intervalMinutes / 2))
            }
          } else {
            console.warn('[SessionProvider] No session found, attempting reload')
            await loadSession()
            setupSessionTimer(Math.max(5, intervalMinutes / 2))
          }
        } catch (error) {
          console.error('[SessionProvider] Failed to refresh token:', error)
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
      const authClient = graphqlClientCreate(coreApiUrl)

      const result = await authClient
        .mutation(LoginMutation, { email: params.email, password: params.password })
        .toPromise()

      if (result.error) {
        console.error('[signIn] GraphQL error:', result.error)
        setAuthError(result.error.message || 'Sign in failed')
        return false
      }

      if (result.data?.login?.success) {
        const { author, token } = result.data.login

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
            pic: author.pic,
            bio: author.bio,
            links: author.links
          }
        }

        updateSession(sessionData)
        return true
      }

      setAuthError(result.data?.login?.error || 'Sign in failed')
      return false
    } catch (error) {
      console.error('[signIn] Error:', error)
      setAuthError(error instanceof Error ? error.message : 'Sign in failed')
      return false
    }
  }

  /**
   * Регистрация пользователя
   */
  const signUp = async (params: SignupInput): Promise<boolean> => {
    try {
      console.info('[signUp] Attempting sign up:', { email: params.email })
      const authClient = graphqlClientCreate(coreApiUrl)

      const result = await authClient
        .mutation(SignupMutation, { email: params.email, password: params.password, name: params.name })
        .toPromise()

      if (result.data?.registerUser?.success) {
        const { author, token } = result.data.registerUser

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
            pic: author.pic,
            bio: author.bio,
            links: author.links
          }
        }

        updateSession(sessionData)
        return true
      }

      setAuthError(result.data?.registerUser?.error || 'Sign up failed')
      return false
    } catch (error) {
      console.error('[signUp] Error:', error)
      setAuthError(error instanceof Error ? error.message : 'Sign up failed')
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
      if (currentSession?.token) {
        const authClient = graphqlClientCreate(coreApiUrl, currentSession.token)
        await authClient.mutation(LogoutMutation, {}).toPromise()
      }

      // Очищаем сессию
      updateSession(undefined)
      toast.success(t("You've successfully logged out"))
      return true
    } catch (error) {
      console.error('[signOut] Error:', error)
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
          console.error('[updateProfile] Security update error:', securityUpdateResult.error)
          throw new Error(securityUpdateResult.error.message)
        }

        if (securityUpdateResult.data?.updateSecurity?.error) {
          console.error(
            '[updateProfile] Security update failed:',
            securityUpdateResult.data.updateSecurity.error
          )
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
        console.error('[updateProfile] Profile update error:', profileUpdateResult.error)
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
      console.error('[updateProfile] Error:', error)
      setAuthError(error instanceof Error ? error.message : 'Profile update failed')
      return false
    }
  }

  /**
   * Обновление токена
   */
  const refreshToken = async (): Promise<boolean> => {
    try {
      console.info('[refreshToken] Refreshing token')

      const currentToken =
        untrack(() => sessionToken()) || (isServer ? null : localStorage.getItem(AUTH_TOKEN_KEY))
      if (!currentToken) {
        console.warn('[refreshToken] No token available for refresh')
        return false
      }

      const authClient = graphqlClientCreate(coreApiUrl, currentToken)
      const result = await authClient.mutation(RefreshTokenMutation, {}).toPromise()

      if (result.error) {
        console.error('[refreshToken] GraphQL error:', result.error)
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
            pic: author.pic,
            bio: author.bio,
            links: author.links
          }
        }

        updateSession(sessionData)
        return true
      }

      console.error('[refreshToken] Token refresh failed:', result.data?.refreshToken?.error)
      return false
    } catch (error) {
      console.error('[refreshToken] Error:', error)
      return false
    }
  }

  /**
   * Требование авторизации
   */
  const requireAuthentication = async (
    callback: (() => Promise<void>) | (() => void),
    modalSource: ModalSource
  ) => {
    console.info('[requireAuthentication] Require authentication from', modalSource)

    try {
      const currentClient = untrack(() => client())
      if (!currentClient) {
        console.warn('[requireAuthentication] GraphQL client is not ready')
        toast.error(t('Connection error'))
        return
      }

      const currentSession = untrack(() => session())
      if (currentSession?.token) {
        try {
          await callback()
        } catch (callbackError) {
          console.error('[requireAuthentication] Callback execution error:', callbackError)
          toast.error(t('Operation failed'))

          // Если была ошибка авторизации, перенаправляем на форму входа
          if (
            callbackError instanceof Error &&
            (callbackError.message.includes('unauthorized') ||
              callbackError.message.includes('unauthenticated'))
          ) {
            updateSession(undefined)
            changeSearchParams({ mode: 'sign-in', m: 'auth' }, { replace: true })
          }
        }
      } else {
        changeSearchParams({ mode: 'sign-in', m: 'auth' }, { replace: true })
      }
    } catch (error) {
      console.error('[requireAuthentication] Unexpected error:', error)
      toast.error(t('Try again later'))
    }
  }

  // Простые вспомогательные функции для других операций
  const changePassword = async (password: string, token: string): Promise<boolean> => {
    try {
      const authClient = graphqlClientCreate(coreApiUrl)
      const result = await authClient
        .mutation(ResetPasswordMutation, { newPassword: password, token })
        .toPromise()
      return !!result.data?.resetPassword?.success
    } catch (error) {
      console.error('[changePassword] Error:', error)
      return false
    }
  }

  const forgotPassword = async (params: ForgotPasswordInput): Promise<string> => {
    try {
      const authClient = graphqlClientCreate(coreApiUrl)
      const result = await authClient
        .mutation(RequestPasswordResetMutation, { email: params.email })
        .toPromise()

      if (result.data?.requestPasswordReset?.success) {
        return ''
      }

      return 'Failed to send password reset email'
    } catch (error) {
      console.error('[forgotPassword] Error:', error)
      return error instanceof Error ? error.message : 'Failed to request password reset'
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
              pic: author.pic,
              bio: author.bio,
              links: author.links
            }
          }
          updateSession(sessionData)
        }

        return true
      }

      setAuthError(result.data?.confirmEmail?.error || 'Email confirmation failed')
      return false
    } catch (error) {
      console.error('[confirmEmail] Error:', error)
      setAuthError(error instanceof Error ? error.message : 'Email confirmation failed')
      return false
    }
  }

  /**
   * Повторная отправка подтверждения email
   */
  const resendVerifyEmail = async (params: ResendVerifyEmailInput): Promise<boolean> => {
    try {
      console.info('[resendVerifyEmail] Resending verification email:', { email: params.email })
      const authClient = graphqlClientCreate(coreApiUrl)
      const result = await authClient
        .mutation(ResendVerifyEmailMutation, { email: params.email })
        .toPromise()

      if (result.data?.resendConfirmationEmail?.success) {
        return true
      }

      setAuthError(result.data?.resendConfirmationEmail?.error || 'Failed to resend verification email')
      return false
    } catch (error) {
      console.error('[resendVerifyEmail] Error:', error)
      setAuthError(error instanceof Error ? error.message : 'Failed to resend verification email')
      return false
    }
  }

  /**
   * Проверка занятости email адреса (возвращает строку статуса)
   */
  const isRegistered = async (email: string): Promise<string> => {
    try {
      console.info('[isRegistered] Checking email registration status:', { email })
      const authClient = graphqlClientCreate(coreApiUrl)
      const result = await authClient.query(IsEmailUsedQuery, { email }).toPromise()

      if (result.error) {
        console.error('[isRegistered] GraphQL error:', result.error)
        return ''
      }

      // Возвращаем статус как строку для совместимости с RegisterForm
      return result.data?.isEmailUsed ? 'registered' : ''
    } catch (error) {
      console.error('[isRegistered] Error:', error)
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
      // Генерируем безопасный state для OAuth с дополнительными данными
      const state = crypto.randomUUID()
      const timestamp = Date.now()

      // Сохраняем состояние OAuth с timestamp для проверки TTL
      const oauthState = {
        state,
        provider: provider.toLowerCase(),
        timestamp,
        redirectUri: window.location.origin
      }

      localStorage.setItem('oauth_state', JSON.stringify(oauthState))

      // Формируем URL для OAuth с дополнительными параметрами безопасности
      const oauthParams = new URLSearchParams({
        state,
        redirect_uri: encodeURIComponent(window.location.origin),
        timestamp: timestamp.toString()
      })

      // Обрабатываем специальный случай для x.com (нормализуем до twitter для API)
      const apiProvider = provider.toLowerCase() === 'x.com' ? 'twitter' : provider.toLowerCase()

      const oauthUrl = `${coreApiUrl.replace('/graphql', '')}/oauth/${apiProvider}?${oauthParams.toString()}`

      console.info('[oauth] Redirecting to provider:', {
        provider,
        apiProvider,
        state: `${state.substring(0, 8)}...`
      })

      // Перенаправляем на OAuth провайдера
      window.location.href = oauthUrl
    } catch (error) {
      console.error('[oauth] Error starting OAuth flow:', error)
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
        console.error('[confirmEmailChange] GraphQL error:', result.error)
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
    } catch (error) {
      console.error('[confirmEmailChange] Error:', error)
      setAuthError(error instanceof Error ? error.message : 'Email change confirmation failed')
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
        console.error('[cancelEmailChange] GraphQL error:', result.error)
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
    } catch (error) {
      console.error('[cancelEmailChange] Error:', error)
      setAuthError(error instanceof Error ? error.message : 'Email change cancellation failed')
      return false
    }
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
