import { useSearchParams } from '@solidjs/router'
import { Client } from '@urql/core'
import type { Accessor, JSX, Resource } from 'solid-js'
import {
  createContext,
  createEffect,
  createResource,
  createSignal,
  createMemo,
  on,
  onCleanup,
  onMount,
  useContext
} from 'solid-js'
import toast from 'solid-toast'
import { useLocalize } from '~/context/localize'
import { type ModalSource } from '~/context/ui'
import { graphqlClientCreate } from '~/graphql/client'
import { Author } from '~/graphql/schema/core.gen'
import { coreApiUrl } from '../config'
import LoginMutation from '~/graphql/mutation/core/auth-login'
import GetSessionMutation from '~/graphql/mutation/core/auth-get-session'
import SignupMutation from '~/graphql/mutation/core/auth-signup'
import LogoutMutation from '~/graphql/mutation/core/auth-logout'
import ResetPasswordMutation from '~/graphql/mutation/core/auth-reset-password'
import RequestPasswordResetMutation from '~/graphql/mutation/core/auth-request-password-reset'
import ResendVerifyEmailMutation from '~/graphql/mutation/core/auth-resend-verify-email'
import ConfirmEmailMutation from '~/graphql/mutation/core/auth-confirm-email'
import UpdateProfileMutation from '~/graphql/mutation/core/auth-update-profile'
import RefreshTokenMutation from '~/graphql/mutation/core/auth-refresh-token'
import IsEmailUsedQuery from '~/graphql/query/core/auth-is-email-used'

/**
 * Ключ для хранения токена авторизации в localStorage
 */
export const AUTH_TOKEN_KEY = 'auth_token'

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
  confirm_new_password?: string
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

export type SessionContextType = {
  session: Resource<AuthPayload | undefined>
  authError: Accessor<string>
  isSessionLoaded: Accessor<boolean>
  loadSession: () => Promise<AuthPayload | undefined> | undefined
  setSession: (token: AuthPayload | undefined) => void
  requireAuthentication: (callback: (() => Promise<void>) | (() => void), modalSource: ModalSource) => void
  signUp: (params: SignupInput) => Promise<boolean>
  signIn: (params: LoginInput) => Promise<boolean>
  updateProfile: (params: UpdateProfileInput) => Promise<boolean>
  signOut: () => Promise<boolean>
  oauth: (provider: string) => Promise<void>
  forgotPassword: (params: ForgotPasswordInput) => Promise<string>
  changePassword: (password: string, token: string) => Promise<boolean>
  confirmEmail: (input: VerifyEmailInput) => Promise<void>
  setIsSessionLoaded: (loaded: boolean) => void
  isRegistered: (email: string) => Promise<string>
  resendVerifyEmail: (params: ResendVerifyEmailInput) => Promise<boolean>
  client: Accessor<Client | undefined>
  isAuthenticated: Accessor<boolean>
  refreshClient: () => Promise<void>
  refreshToken: () => Promise<boolean>
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
 * It handles session management, authentication, and provides related functions.
 * @param props - The props containing an onStateChangeCallback function and children elements.
 * @returns A JSX Element wrapping the children with session context.
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

  const clearSearchParams = () => changeSearchParams({}, { replace: true })
  const [oauthState, setOauthState] = createSignal<string>()

  // Session expiration timer
  let minuteLater: ReturnType<typeof setTimeout> | null = null
  const [isSessionLoaded, setIsSessionLoaded] = createSignal(false)
  const [authError, setAuthError] = createSignal<string>('')

  // Оптимизируем создание GraphQL клиента
  const [client, setClient] = createSignal<Client>()
  const [lastClientToken, setLastClientToken] = createSignal<string>('')

  // Handle auth state callback from outside
  onMount(() => {
    const params = searchParams
    if (params?.state) {
      setOauthState(params.state)
      const scope = params.scope ? params.scope.toString().split(' ') : ['openid', 'profile', 'email']
      if (scope) console.info(`[context.session] scope: ${scope}`)
      // const url = params.redirect_uri || params.redirectURL || window.location.href
      changeSearchParams({ mode: 'confirm-email', m: 'auth' }, { replace: true })
    }
  })

  // Handle token confirmation
  createEffect(() => {
    const token = searchParams?.token
    const access_token = searchParams?.access_token
    if (access_token) {
      changeSearchParams(
        {
          mode: 'confirm-email',
          m: 'auth',
          access_token
        },
        { replace: true }
      )
    } else if (token) {
      changeSearchParams(
        {
          mode: 'change-password',
          m: 'auth',
          token
        },
        { replace: true }
      )
    }
  })

  /**
   * Функция загрузки сессии через GraphQL API
   */
  const sessionData = async () => {
    try {
      console.info('[context.session] Attempting to load session via Discours GraphQL API')
      // Проверяем наличие токена в localStorage
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)

      if (storedToken) {
        // Создаем клиент с токеном
        const internalClient = graphqlClientCreate(coreApiUrl, storedToken)

        // Проверяем доступность API перед запросом данных
        try {
          // Запрашиваем данные пользователя с помощью GraphQL
          const result = await internalClient
            .mutation(GetSessionMutation,
              {}
            )
            .toPromise()

          if (result.error) {
            console.error('[context.session] Error refreshing session:', result.error)
            localStorage.removeItem(AUTH_TOKEN_KEY)
            setAuthError(`Ошибка обновления сессии: ${result.error.message || 'неизвестная ошибка'}`)
            setIsSessionLoaded(true)
            return undefined
          }

          if (result.data?.getSession) {
            const { author, token } = result.data.getSession

            // Формируем объект сессии
            const AuthPayload: AuthPayload = {
              token,
              author: {
                id: author.id,
                slug: author.slug,
                name: author.name,
                pic: author.pic,
                bio: author.bio,
                links: author.links
              }
            }

            console.info('[context.session] Successfully loaded session via Discours GraphQL API')
            clearSearchParams()

            // Устанавливаем флаг загрузки сессии
            setIsSessionLoaded(true)

            return AuthPayload
          }
          
          console.error('[context.session] No valid session data returned')
          // Если запрос не вернул данные, удаляем токен
          localStorage.removeItem(AUTH_TOKEN_KEY)
          setAuthError('Не удалось получить данные сессии')
          setIsSessionLoaded(true)
          return undefined
        } catch (queryError) {
          console.error('[context.session] Query error:', queryError)
          // Если запрос завершился ошибкой, удаляем токен
          localStorage.removeItem(AUTH_TOKEN_KEY)
          setAuthError(
            `Ошибка запроса данных: ${queryError instanceof Error ? queryError.message : 'неизвестная ошибка'}`
          )
        }
      }

      console.info('[context.session] cannot refresh session - no valid token')
      setAuthError('Сессия не найдена или истекла')

      // Устанавливаем флаг загрузки сессии
      setIsSessionLoaded(true)
      return undefined
    } catch (error) {
      console.error('[context.session] cannot refresh session', error)
      if (error instanceof Error) {
        console.error('[context.session] error details:', error.message)
        setAuthError(`Ошибка: ${error.message}`)
      } else {
        setAuthError(t('error'))
      }

      // Устанавливаем флаг загрузки сессии
      setIsSessionLoaded(true)
      return undefined
    }
  }

  const [session, { mutate: setSession }] = createResource<AuthPayload | undefined>(sessionData, {
    ssrLoadFrom: 'initial',
    initialValue: undefined
  })

  // Явно определяем loadSession с соответствующим типом
  const loadSession = async () => {
    return await sessionData()
  }

  /**
   * Устанавливает таймер для проверки и обновления сессии
   * @param {number} intervalMinutes - Интервал проверки в минутах (по умолчанию 30 минут)
   */
  const setupSessionTimer = (intervalMinutes = 30) => {
    if (minuteLater) clearTimeout(minuteLater)

    // Установка интервала в миллисекундах
    const intervalMs = intervalMinutes * 60 * 1000

    minuteLater = setTimeout(async () => {
      console.info(`[context.session] Refreshing session after ${intervalMinutes} minutes`)
      try {
        await loadSession()
        console.info('[context.session] Session refresh completed')
        // Если успешно обновили сессию, устанавливаем следующий таймер
        setupSessionTimer(intervalMinutes)
      } catch (error) {
        console.error('[context.session] Failed to refresh session:', error)
        // Если произошла ошибка, попробуем обновить сессию через меньший интервал
        setupSessionTimer(Math.max(5, intervalMinutes / 2))
      }
    }, intervalMs)
    console.info(`[context.session] Will refresh in ${intervalMinutes} minutes`)
  }

  onCleanup(() => {
    if (minuteLater) clearTimeout(minuteLater)
  })

  // Initial effect
  onMount(() => {
    loadSession()
  })

  // Объединяем эффекты для работы с сессией
  createEffect(
    on(
      () => [session(), searchParams?.token, searchParams?.access_token, searchParams?.state] as const,
      ([currentSession, token, access_token, state]) => {
        // Обработка OAuth токенов
        if (state && access_token) {
          console.info('[context.session] Processing OAuth callback')
          const storedState = localStorage.getItem('oauth_state')
          
          if (storedState === state) {
            console.info('[context.session] OAuth state verified')
            changeSearchParams(
              {
                mode: 'confirm-email',
                m: 'auth',
                access_token
              },
              { replace: true }
            )
            localStorage.removeItem('oauth_state')
          } else {
            console.warn('[context.session] OAuth state mismatch')
            setAuthError('Ошибка авторизации: неверное состояние OAuth')
          }
          return
        }

        // Обработка обычных токенов
        if (token) {
          console.info('[context.session] Processing password reset token')
          changeSearchParams(
            {
              mode: 'change-password',
              m: 'auth',
              token
            },
            { replace: true }
          )
        }

        // Обработка изменения сессии
        if (currentSession) {
          const currentToken = currentSession.token
          if (currentToken !== lastClientToken()) {
            console.log('[session] Creating GraphQL client with token:', !!currentToken)
            setLastClientToken(currentToken)
            setClient(() => graphqlClientCreate(coreApiUrl, currentToken))
            props.onStateChangeCallback(currentSession)
            setupSessionTimer()
          } else {
            console.log('[session] Session exists but token unchanged, client already configured')
          }
        } else {
          // Если сессия отсутствует, создаем клиент без токена
          if (lastClientToken() !== '') {
            console.log('[session] Using default client (no token)')
            setLastClientToken('')
            setClient(() => graphqlClientCreate(coreApiUrl))
          }
        }
      },
      { defer: true }
    )
  )

  const [authCallback, setAuthCallback] = createSignal<() => void>(() => {})
  const [lastHandlerRun, setLastHandlerRun] = createSignal<string>('')

  // Оптимизируем обработку authCallback
  createEffect(
    on(
      authCallback,
      (handler) => {
        if (typeof handler === 'function' && handler !== noopSetter) {
          const handlerId = Math.random().toString(36).substr(2, 9)
          if (lastHandlerRun() !== handlerId) {
            setLastHandlerRun(handlerId)
            queueMicrotask(() => {
              handler()
              setAuthCallback(noopSetter)
            })
          }
        }
      },
      { defer: true }
    )
  )

  /**
   * Requires the user to be authenticated before executing a callback function.
   * If the user is not authenticated, it shows the authentication modal.
   * @param callback - The function to execute after authentication.
   * @param modalSource - The source of the authentication modal.
   */
  const requireAuthentication = async (
    callback: (() => Promise<void>) | (() => void),
    modalSource: ModalSource
  ) => {
    console.info('[context.session] Require authentication from', modalSource)
    try {
      if (!client()) {
        console.warn('[requireAuthentication] GraphQL client is not ready')
        toast.error(t('Connection error'))
        return
      }

      if (session()?.token) {
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
            // Сбрасываем сессию и перенаправляем на вход
            setSession(undefined)
            localStorage.removeItem(AUTH_TOKEN_KEY)
            changeSearchParams(
              {
                mode: 'sign-in',
                m: 'auth'
              },
              { replace: true }
            )
          }
        }
      } else {
        changeSearchParams(
          {
            mode: 'sign-in',
            m: 'auth'
          },
          { replace: true }
        )
      }
    } catch (error) {
      console.error('[requireAuthentication] Unexpected error:', error)
      toast.error(t('Try again later'))
    }
  }

  const noopSetter = () => () => void 0

  /**
   * Функция входа через GraphQL API
   */
  const signIn = async (params: LoginInput): Promise<boolean> => {
    try {
      console.info('[context.session] Attempting to sign in via Discours GraphQL API', {
        email: params.email
      })
      const internalClient = graphqlClientCreate(coreApiUrl)

      // Выполняем мутацию login через GraphQL API
      const result = await internalClient
        .mutation(LoginMutation,
          {
            email: params.email,
            password: params.password
          }
        )
        .toPromise()

      if (result.error) {
        console.error('[signIn] GraphQL error:', result.error)
        setAuthError(result.error.message || 'Ошибка сервера при попытке входа')
        return false
      }

      if (result.data?.login?.success) {
        const { author, token } = result.data.login

        // Сохраняем токен в localStorage
        localStorage.setItem(AUTH_TOKEN_KEY, token)

        // Формируем объект сессии
        const AuthPayload: AuthPayload = {
          token,
          author: {
            id: author.id,
            slug: author.slug,
            name: author.name,
            pic: author.pic,
            bio: author.bio,
            links: author.links
          }
        }

        // Сразу обновляем клиент с новым токеном
        console.log('[session] Immediately updating GraphQL client with token')
        setLastClientToken(token)
        setClient(() => graphqlClientCreate(coreApiUrl, token))

        // Устанавливаем сессию
        setSession(AuthPayload)
        return true
      }

      setAuthError(result.data?.login?.error || 'Ошибка при входе')
      return false
    } catch (error) {
      console.error('[signIn] error:', error)
      if (error instanceof Error) {
        console.error('[signIn] error details:', error.message)
        setAuthError(error.message || 'Не удалось выполнить вход')
      } else {
        setAuthError(typeof error === 'string' ? error : 'Не удалось выполнить вход')
      }
      return false
    }
  }

  /**
   * Регистрация нового пользователя через GraphQL API
   */
  const signUp = async (params: SignupInput): Promise<boolean> => {
    try {
      console.info('[context.session] Attempting to register via Discours GraphQL API', {
        email: params.email
      })
      const internalClient = graphqlClientCreate(coreApiUrl)

      // Выполняем мутацию registerUser через GraphQL API
      const result = await internalClient
        .mutation(SignupMutation,
          {
            email: params.email,
            password: params.password,
            name: params.name
          }
        )
        .toPromise()

      if (result.data?.registerUser?.success) {
        const { author, token } = result.data.registerUser

        // Сохраняем токен в localStorage
        localStorage.setItem(AUTH_TOKEN_KEY, token)

        // Формируем объект сессии
        const AuthPayload: AuthPayload = {
          token,
          author: {
            id: author.id,
            slug: author.slug,
            name: author.name,
            pic: author.pic,
            bio: author.bio,
            links: author.links
          }
        }

        // Сразу обновляем клиент с новым токеном
        console.log('[session] Immediately updating GraphQL client with token')
        setLastClientToken(token)
        setClient(() => graphqlClientCreate(coreApiUrl, token))

        setSession(AuthPayload)
        return true
      }

      setAuthError(result.data?.registerUser?.error || 'Ошибка при регистрации')
      return false
    } catch (error) {
      console.error('[signUp] error:', error)
      setAuthError(typeof error === 'string' ? error : 'Не удалось зарегистрироваться')
      return false
    }
  }

  /**
   * Обновление профиля пользователя через GraphQL API
   */
  const updateProfile = async (params: UpdateProfileInput): Promise<boolean> => {
    try {
      if (!session()?.token) {
        setAuthError('Не авторизован')
        return false
      }

      const internalClient = graphqlClientCreate(coreApiUrl, session()?.token)

      // Выполняем мутацию update_author через GraphQL API
      const result = await internalClient
        .mutation(
          UpdateProfileMutation,
          {
            profile: {
              name: params.name,
              bio: params.bio,
              about: params.about,
              links: params.links,
              pic: params.pic,
              slug: params.slug
            }
          }
        )
        .toPromise()

      if (!result.data?.update_author?.error) {
        // Обновляем данные пользователя в сессии
        loadSession()
        return true
      }

      setAuthError(result.data?.update_author?.error || 'Ошибка при обновлении профиля')
      return false
    } catch (error) {
      console.error('[updateProfile] error:', error)
      setAuthError(typeof error === 'string' ? error : 'Не удалось обновить профиль')
      return false
    }
  }

  /**
   * Выход пользователя через GraphQL API
   */
  const signOut = async (): Promise<boolean> => {
    try {
      console.info('[context.session] Attempting to log out via Discours GraphQL API')
      if (session()?.token) {
        const internalClient = graphqlClientCreate(coreApiUrl, session()?.token)

        // Выполняем мутацию logout через GraphQL API
        await internalClient
          .mutation(
            LogoutMutation,
            {}
          )
          .toPromise()
      }

      // Удаляем токен из localStorage
      localStorage.removeItem(AUTH_TOKEN_KEY)

      // Очищаем сессию
      setSession(undefined)
      setIsSessionLoaded(true)

      toast.success(t("You've successfully logged out"))
      return true
    } catch (error) {
      console.error('[signOut] error:', error)
      return false
    }
  }

  /**
   * Изменение пароля через GraphQL API
   */
  const changePassword = async (password: string, token: string): Promise<boolean> => {
    try {
      const internalClient = graphqlClientCreate(coreApiUrl)

      // Выполняем мутацию resetPassword через GraphQL API
      const result = await internalClient
        .mutation(
          ResetPasswordMutation,
          {
            newPassword: password,
            token
          }
        )
        .toPromise()

      return !!result.data?.resetPassword?.success
    } catch (error) {
      console.error('[changePassword] error:', error)
      return false
    }
  }

  /**
   * Запрос на восстановление пароля через GraphQL API
   */
  const forgotPassword = async (params: ForgotPasswordInput): Promise<string> => {
    try {
      const internalClient = graphqlClientCreate(coreApiUrl)

      // Выполняем мутацию requestPasswordReset через GraphQL API
      const result = await internalClient
        .mutation(
          RequestPasswordResetMutation,
          {
            email: params.email
          }
        )
        .toPromise()

      if (result.data?.requestPasswordReset?.success) {
        return ''
      }

      return 'Не удалось отправить письмо для сброса пароля'
    } catch (error) {
      console.error('[forgotPassword] error:', error)
      return typeof error === 'string' ? error : 'Не удалось запросить сброс пароля'
    }
  }

  /**
   * Повторная отправка письма для подтверждения email
   */
  const resendVerifyEmail = async (params: ResendVerifyEmailInput): Promise<boolean> => {
    try {
      const internalClient = graphqlClientCreate(coreApiUrl)

      // Выполняем мутацию для повторной отправки письма с подтверждением
      const result = await internalClient
        .mutation(
          ResendVerifyEmailMutation,
          {
            email: params.email
          }
        )
        .toPromise()

      if (result.data?.sendLink) {
        toast.success('Письмо для подтверждения отправлено. Пожалуйста, проверьте вашу почту')
        return true
      }

      toast.error('Не удалось отправить письмо для подтверждения')
      return false
    } catch (error) {
      console.error('[resendVerifyEmail] error:', error)
      toast.error(typeof error === 'string' ? error : 'Не удалось отправить письмо для подтверждения')
      return false
    }
  }

  /**
   * Проверка, зарегистрирован ли email
   */
  const isRegistered = async (email: string): Promise<string> => {
    try {
      const internalClient = graphqlClientCreate(coreApiUrl)

      // Выполняем запрос isEmailUsed через GraphQL API
      const result = await internalClient
        .query(
          IsEmailUsedQuery,
          {
            email
          }
        )
        .toPromise()

      return result.data?.isEmailUsed ? 'Email уже зарегистрирован' : ''
    } catch (error) {
      console.error('[isRegistered] error:', error)
      return ''
    }
  }

  /**
   * Подтверждение email через GraphQL API
   */
  const confirmEmail = async (input: VerifyEmailInput): Promise<void> => {
    try {
      const internalClient = graphqlClientCreate(coreApiUrl)

      // Выполняем мутацию confirmEmail через GraphQL API
      const result = await internalClient
        .mutation(
          ConfirmEmailMutation,
          {
            token: input.token
          }
        )
        .toPromise()

      if (result.data?.confirmEmail?.success) {
        const { author, token } = result.data.confirmEmail

        // Сохраняем токен в localStorage
        localStorage.setItem(AUTH_TOKEN_KEY, token)

        // Формируем объект сессии
        const AuthPayload: AuthPayload = {
          token,
          author: {
            id: author.id,
            slug: author.slug,
            name: author.name,
            pic: author.pic,
            bio: author.bio,
            links: author.links
          }
        }

        // Сразу обновляем клиент с новым токеном
        console.log('[session] Immediately updating GraphQL client with token')
        setLastClientToken(token)
        setClient(() => graphqlClientCreate(coreApiUrl, token))

        setSession(AuthPayload)
      }
    } catch (error) {
      console.error('[confirmEmail] error:', error)
    }
  }

  /**
   * OAuth авторизация через GraphQL API
   * @param {string} provider - Провайдер OAuth (например, 'google', 'github')
   */
  const oauth = async (provider: string): Promise<void> => {
    try {
      console.info(`[context.session] Initiating OAuth flow with provider: ${provider}`)
      const state = oauthState() || Math.random().toString(36).substring(2, 15)
      const redirectUri = window.location.origin

      // Сохраняем состояние в localStorage для проверки после возвращения
      localStorage.setItem('oauth_state', state)

      // Формируем URL для OAuth редиректа
      const baseUrl = coreApiUrl.replace('/graphql', '')
      const oauthUrl = `${baseUrl}/oauth/${provider}?state=${state}&redirect_uri=${redirectUri}`

      console.info(`[context.session] Redirecting to OAuth provider: ${oauthUrl}`)
      window.location.href = oauthUrl
    } catch (error) {
      console.error(`[context.session] OAuth error with provider ${provider}:`, error)
      toast.error(t('Authentication failed'))

      // Очищаем состояние в случае ошибки
      localStorage.removeItem('oauth_state')
    }
  }

  /**
   * Вспомогательная функция, которая проверяет авторизован ли пользователь
   * с учетом статуса загрузки сессии
   */
  const isAuthenticated = createMemo(() => {
    const sessionLoaded = isSessionLoaded();
    const hasToken = !!session()?.token;
    const hasClient = !!client();
    
    if (hasToken && !hasClient) {
      console.warn('[session] Inconsistent state: token exists but client is not initialized');
    }
    
    return sessionLoaded && hasToken;
  })

  /**
   * Принудительное обновление GraphQL клиента с текущим токеном
   * Используется в случаях, когда клиент не был правильно инициализирован
   * @returns Promise, который разрешается, когда клиент обновлен
   */
  const refreshClient = () => {
    return new Promise<void>((resolve) => {
      const currentToken = session()?.token || '';
      console.log('[session] Manually refreshing GraphQL client with token:', !!currentToken);
      
      // Создаем новый клиент с токеном
      const newClient = graphqlClientCreate(coreApiUrl, currentToken);
      
      // Обновляем состояние
      setLastClientToken(currentToken);
      setClient(() => newClient);
      
      // Небольшая задержка для гарантии обновления состояния
      setTimeout(() => {
        if (!client()) {
          console.warn('[session] Client still not available after refresh');
        }
        resolve();
      }, 50);
    });
  }

  /**
   * Обновление токена авторизации через GraphQL API
   * @returns Promise<boolean> - успешность обновления токена
   */
  const refreshToken = async (): Promise<boolean> => {
    try {
      console.info('[context.session] Attempting to refresh token via Discours GraphQL API')
      const currentToken = session()?.token || localStorage.getItem(AUTH_TOKEN_KEY)
      
      if (!currentToken) {
        console.warn('[refreshToken] No token available for refresh')
        return false
      }
      
      const internalClient = graphqlClientCreate(coreApiUrl, currentToken)

      // Выполняем мутацию refreshToken через GraphQL API
      const result = await internalClient
        .mutation(RefreshTokenMutation, {})
        .toPromise()

      if (result.error) {
        console.error('[refreshToken] GraphQL error:', result.error)
        return false
      }

      if (result.data?.refreshToken?.success) {
        const { author, token } = result.data.refreshToken

        // Сохраняем новый токен в localStorage
        localStorage.setItem(AUTH_TOKEN_KEY, token)

        // Формируем объект сессии
        const AuthPayload: AuthPayload = {
          token,
          author: {
            id: author.id,
            slug: author.slug,
            name: author.name,
            pic: author.pic,
            bio: author.bio,
            links: author.links
          }
        }

        // Обновляем клиент с новым токеном
        setLastClientToken(token)
        setClient(() => graphqlClientCreate(coreApiUrl, token))

        // Устанавливаем сессию
        setSession(AuthPayload)
        return true
      }

      console.error('[refreshToken] Token refresh failed:', result.data?.refreshToken?.error)
      return false
    } catch (error) {
      console.error('[refreshToken] error:', error)
      return false
    }
  }

  const actions = {
    loadSession,
    requireAuthentication,
    signUp,
    signIn,
    signOut,
    confirmEmail,
    updateProfile,
    setIsSessionLoaded,
    setSession,
    forgotPassword,
    changePassword,
    oauth,
    isRegistered,
    refreshClient,
    refreshToken
  }
  const value: SessionContextType = {
    client,
    authError,
    session,
    isSessionLoaded,
    ...actions,
    resendVerifyEmail,
    isAuthenticated
  }

  return <SessionContext.Provider value={value}>{props.children}</SessionContext.Provider>
}

export const sessionStateChanged = (payload: AuthPayload | null) => {
  console.log('[session] Session state changed:', payload)
}
