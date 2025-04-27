import {
  ApiResponse,
  AuthToken,
  Authorizer,
  ConfigType,
  ForgotPasswordInput,
  GenericResponse,
  LoginInput,
  ResendVerifyEmailInput,
  SignupInput,
  UpdateProfileInput,
  VerifyEmailInput
} from '@authorizerdev/authorizer-js'
import { useSearchParams } from '@solidjs/router'
import { Client } from '@urql/core'
import type { Accessor, JSX, Resource } from 'solid-js'
import {
  createContext,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  onCleanup,
  onMount,
  useContext
} from 'solid-js'
import toast from 'solid-toast'
import { type ModalSource } from '~/context/ui'
import { graphqlClientCreate } from '~/graphql/client'
import { authApiUrl, authorizerClientId, authorizerRedirectUrl, coreApiUrl } from '../config'
import { useLocalize } from './localize'

const defaultConfig: ConfigType = {
  authorizerURL: authApiUrl.replace('/graphql', ''),
  redirectURL: authorizerRedirectUrl,
  clientID: authorizerClientId
}

export type SessionContextType = {
  config: Accessor<ConfigType>
  session: Resource<AuthToken>
  authError: Accessor<string>
  isSessionLoaded: Accessor<boolean>
  loadSession: () => AuthToken | Promise<AuthToken> | undefined | null
  setSession: (token: AuthToken) => void
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
  authorizer: () => Authorizer
  isRegistered: (email: string) => Promise<string>
  resendVerifyEmail: (params: ResendVerifyEmailInput) => Promise<boolean>
  client: Accessor<Client | undefined>
}

const noop = () => null

const metaRes = {
  data: {
    meta: {
      version: 'latest',
      client_id: authorizerClientId,
      is_google_login_enabled: true,
      is_facebook_login_enabled: true,
      is_github_login_enabled: true,
      is_linkedin_login_enabled: false,
      is_apple_login_enabled: false,
      is_twitter_login_enabled: true,
      is_microsoft_login_enabled: false,
      is_twitch_login_enabled: false,
      is_roblox_login_enabled: false,
      is_email_verification_enabled: true,
      is_basic_authentication_enabled: true,
      is_magic_link_login_enabled: true,
      is_sign_up_enabled: true,
      is_strong_password_enabled: false,
      is_multi_factor_auth_enabled: true,
      is_mobile_basic_authentication_enabled: true,
      is_phone_verification_enabled: false
    }
  }
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
  onStateChangeCallback(state: AuthToken): unknown
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
  const [config, setConfig] = createSignal<ConfigType>(defaultConfig)
  const authorizer = createMemo(() => new Authorizer(config()))
  const [oauthState, setOauthState] = createSignal<string>()

  // Session expiration timer
  let minuteLater: ReturnType<typeof setTimeout> | null = null
  const [isSessionLoaded, setIsSessionLoaded] = createSignal(false)
  const [authError, setAuthError] = createSignal<string>('')

  // Handle auth state callback from outside
  onMount(() => {
    const params = searchParams
    if (params?.state) {
      setOauthState(params.state)
      const scope = params.scope ? params.scope.toString().split(' ') : ['openid', 'profile', 'email']
      if (scope) console.info(`[context.session] scope: ${scope}`)
      const url = params.redirect_uri || params.redirectURL || window.location.href
      setConfig((c: ConfigType) => ({ ...c, redirectURL: url.split('?')[0] }))
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
   * Function to load session data by fetching the current session from the authorizer.
   * It handles session expiration and sets up a timer to refresh the session as needed.
   * @returns A Promise resolving to the AuthToken containing session information.
   */
  const sessionData = async () => {
    try {
      const s: ApiResponse<AuthToken> = await authorizer().getSession()
      if (s?.data) {
        console.info('[context.session] loading session', s)
        clearSearchParams()
        // Set session expiration time in local storage
        const expires_at = new Date(Date.now() + s.data.expires_in * 1000)
        localStorage?.setItem('expires_at', `${expires_at.getTime()}`)

        // Set up session expiration check timer
        minuteLater = setTimeout(checkSessionIsExpired, 60 * 1000)
        console.info(`[context.session] will refresh in ${Math.round(s.data.expires_in / 60)} mins`)

        // Set the session loaded flag
        setIsSessionLoaded(true)

        return s.data
      }
      console.info('[context.session] cannot refresh session', s.errors)
      setAuthError(s.errors?.pop()?.message || '')

      // Set the session loaded flag even if there's an error
      setIsSessionLoaded(true)
    } catch (error) {
      console.info('[context.session] cannot refresh session', error)
      if (error) setAuthError(t('error'))

      // Set the session loaded flag even if there's an error
      setIsSessionLoaded(true)
    }
    return {} as AuthToken
  }

  const [session, { refetch: loadSession, mutate: setSession }] = createResource<AuthToken>(sessionData, {
    ssrLoadFrom: 'initial',
    initialValue: {} as AuthToken
  })

  /**
   * Checks if the current session has expired and refreshes the session if necessary.
   * Sets up a timer to check the session expiration every minute.
   */
  const checkSessionIsExpired = () => {
    const expires_at_data = localStorage?.getItem('expires_at')

    if (expires_at_data) {
      const expires_at = Number.parseFloat(expires_at_data)
      const current_time = Date.now()

      // Check if the session has expired
      if (current_time >= expires_at) {
        console.info('[context.session] Session has expired, refreshing.')
        loadSession()
      } else {
        // Schedule the next check
        minuteLater = setTimeout(checkSessionIsExpired, 60 * 1000)
      }
    }
  }

  onCleanup(() => {
    if (minuteLater) clearTimeout(minuteLater)
  })

  // Initial effect
  onMount(() => {
    setConfig({
      ...defaultConfig,
      ...metaRes,
      redirectURL: window.location.origin
    })
    loadSession()
  })

  // Callback state updater
  createEffect(
    on([() => props.onStateChangeCallback, session], ([_, ses]) => {
      if (ses?.user?.id) props.onStateChangeCallback(ses)
    })
  )

  const [authCallback, setAuthCallback] = createSignal<() => void>(noop)

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
    console.info('require auth in ', modalSource)
    try {
      if (!client()) {
        console.warn('[requireAuthentication] client is not ready')
        return
      }
      if (session()?.access_token) {
        await callback()
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
      console.error('Ошибка в requireAuthentication:', error)
      toast.error(t('Try again later'))
    }
  }

  createEffect(() => {
    const handler = authCallback()
    if (handler !== noop) {
      handler()
      setAuthCallback(() => noop)
    }
  })

  /**
   * General function to authenticate a user using a specified authentication function.
   * @param authFunction - The authentication function to use (e.g., signup, login).
   * @param params - The parameters to pass to the authentication function.
   * @returns An object containing data and errors from the authentication attempt.
   */
  type AuthFunctionType = (
    data: SignupInput | LoginInput | UpdateProfileInput
  ) => Promise<ApiResponse<AuthToken | GenericResponse>>
  const authenticate = async (
    authFunction: AuthFunctionType,
    params: SignupInput | LoginInput | UpdateProfileInput
  ) => {
    const resp = await authFunction(params)
    console.debug('[context.session] authenticate:', resp)
    if (resp?.data && resp?.errors.length === 0) setSession(resp.data as AuthToken)
    return { data: resp?.data, errors: resp?.errors }
  }

  /**
   * Signs up a new user using the provided parameters.
   * @param params - The signup input parameters.
   * @returns A Promise resolving to `true` if signup was successful, otherwise `false`.
   */
  const signUp = async (params: SignupInput): Promise<boolean> => {
    const resp = await authenticate(authorizer().signup as AuthFunctionType, params as SignupInput)
    console.debug('[context.session] signUp:', resp)
    if (resp?.data) {
      setSession(resp.data as AuthToken)
      return true
    }
    return false
  }

  /**
   * Signs in a user using the provided credentials.
   * @param params - The login input parameters.
   * @returns A Promise resolving to `true` if sign-in was successful, otherwise `false`.
   */
  const signIn = async (params: LoginInput): Promise<boolean> => {
    const resp = await authenticate(authorizer().login as AuthFunctionType, params)
    console.debug('[context.session] signIn:', resp)
    if (resp?.data) {
      setSession(resp.data as AuthToken)
      return true
    }
    console.warn('[signIn] response: ', resp)
    setAuthError(resp.errors.pop()?.message || '')
    return false
  }

  /**
   * Updates the user's profile with the provided parameters.
   * @param params - The update profile input parameters.
   * @returns A Promise resolving to `true` if the update was successful, otherwise `false`.
   */
  const updateProfile = async (params: UpdateProfileInput): Promise<boolean> => {
    const resp = await authenticate(authorizer().updateProfile, params)
    console.debug('[context.session] updateProfile response:', resp)
    if (resp?.data) {
      // Optionally refresh session or user data here
      return true
    }
    return false
  }

  /**
   * Signs out the current user and clears the session.
   * @returns A Promise resolving to `true` if sign-out was successful.
   */
  const signOut = async (): Promise<boolean> => {
    const authResult: ApiResponse<GenericResponse> = await authorizer().logout()
    if (authResult) {
      setSession({} as AuthToken)
      setIsSessionLoaded(true)
      toast.success(t("You've successfully logged out"))
      return true
    }
    return false
  }

  /**
   * Changes the user's password using a token from a password reset email.
   * @param password - The new password.
   * @param token - The token from the password reset email.
   * @returns A Promise resolving to `true` if the password was changed successfully.
   */
  const changePassword = async (password: string, token: string): Promise<boolean> => {
    const resp = await authorizer().resetPassword({
      password,
      token,
      confirm_password: password
    })
    console.debug('[context.session] change password response:', resp)
    if (resp.data) {
      return true
    }
    return false
  }

  /**
   * Initiates the forgot password process for the given email.
   * @param params - The forgot password input parameters.
   * @returns A Promise resolving to an error message if any, otherwise an empty string.
   */
  const forgotPassword = async (params: ForgotPasswordInput): Promise<string> => {
    const resp = await authorizer().forgotPassword(params)
    console.debug('[context.session] forgot password response:', resp)
    if (resp.errors.length > 0) {
      return resp.errors.pop()?.message || ''
    }
    return ''
  }

  /**
   * Resends the verification email to the user.
   * @param params - The resend verify email input parameters.
   * @returns A Promise resolving to `true` if the email was sent successfully.
   */
  const resendVerifyEmail = async (params: ResendVerifyEmailInput): Promise<boolean> => {
    const resp = await authorizer().resendVerifyEmail(params)
    console.debug('[context.session] resend verify email response:', resp)
    if (resp.errors.length > 0) {
      resp.errors.forEach((error) => {
        toast.error(error.message)
      })
      return false
    }
    return resp.data?.message === 'Verification email has been sent. Please check your inbox'
  }

  /**
   * Checks if an email is already registered.
   * @param email - The email to check.
   * @returns A Promise resolving to the message from the server indicating the registration status.
   */
  const isRegistered = async (email: string): Promise<string> => {
    console.debug('[context.session] calling is_registered for ', email)
    try {
      const response = await authorizer().graphqlQuery({
        query: 'query IsRegistered($email: String!) { is_registered(email: $email) { message }}',
        variables: { email }
      })
      return response?.data?.is_registered?.message
    } catch (error) {
      console.warn(error)
    }
    return ''
  }

  const confirmEmail = async (input: VerifyEmailInput) => {
    console.debug(`[context.session] calling authorizer's verify email with`, input)
    const at: ApiResponse<AuthToken> = await authorizer().verifyEmail(input)
    if (at?.data) {
      setSession(at.data)
    } else {
      console.warn(at)
    }
  }

  const oauth = async (oauthProvider: string) => {
    console.debug(`[context.session] calling authorizer's oauth for`)
    try {
      await authorizer().oauthLogin(oauthProvider, [], window?.location?.origin || '', oauthState())
    } catch (error) {
      console.warn(error)
    }
  }

  // authorized graphql client
  const [client, setClient] = createSignal<Client>()
  createEffect(
    on(session, (token) => {
      console.log('[session] Creating GraphQL client with token:', !!token?.access_token)
      if (token?.access_token) {
        const newClient = graphqlClientCreate(coreApiUrl, token.access_token)
        console.log('[session] New GraphQL client created')
        setClient(() => newClient)
      } else {
        console.log('[session] Using default client (no token)')
        setClient(() => graphqlClientCreate(coreApiUrl))
      }
    })
  )

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
    authorizer,
    forgotPassword,
    changePassword,
    oauth,
    isRegistered
  }
  const value: SessionContextType = {
    client,
    authError,
    config,
    session,
    isSessionLoaded,
    ...actions,
    resendVerifyEmail
  }

  return <SessionContext.Provider value={value}>{props.children}</SessionContext.Provider>
}

export const sessionStateChanged = (payload: AuthToken) => {
  console.log('[session] Session state changed:', payload)
}

export type { AuthToken, UpdateProfileInput }
