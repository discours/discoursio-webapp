import { useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { createSignal, JSX, Show } from 'solid-js'
import { toast } from 'solid-sonner'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'
import { validateEmail } from '~/utils/validate'
import styles from './AuthModal.module.scss'
import { AuthModalHeader } from './AuthModalHeader'
import { PasswordField } from './PasswordField'
import { SocialProviders } from './SocialProviders'
import { email, setEmail } from './sharedLogic'

type FormFields = {
  email: string
  password: string
}

type ValidationErrors = Partial<Record<keyof FormFields, string>>

export const LoginForm = () => {
  const { hideModal } = useUI()
  const [, setSearchParams] = useSearchParams()
  const { t } = useLocalize()
  const [submitError, setSubmitError] = createSignal<string | JSX.Element>()
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  const [password, setPassword] = createSignal('')
  const [validationErrors, setValidationErrors] = createSignal<ValidationErrors>({})
  // FIXME: use signal or remove
  const [_isLinkSent, setIsLinkSent] = createSignal(false)
  let authFormRef: HTMLFormElement
  const { signIn, authError } = useSession()

  const handleEmailInput = (newEmail: string) => {
    setValidationErrors(({ email: _notNeeded, ...rest }) => rest)
    setEmail(newEmail.toLowerCase())
  }

  const handlePasswordInput = (newPassword: string) => {
    setValidationErrors(({ password: _notNeeded, ...rest }) => rest)
    setPassword(newPassword)
  }

  const handleSendLinkAgainClick = (event: Event) => {
    event.preventDefault()

    setIsLinkSent(true)
    setSubmitError()
    setSearchParams({ mode: 'send-confirm-email' })
  }

  const preSendValidate = async (value: string, type: 'email' | 'password'): Promise<boolean> => {
    if (type === 'email') {
      if (value === '' || !validateEmail(value)) {
        setValidationErrors((prev) => ({
          ...prev,
          email: t('Invalid email')
        }))
        return false
      }
    } else if (type === 'password') {
      if (value === '') {
        setValidationErrors((prev) => ({
          ...prev,
          password: t('Please enter password')
        }))
        return false
      }
    }
    return true
  }
  const handleSubmit = async (event: Event) => {
    event.preventDefault()

    console.log('[LoginForm] Начало процесса авторизации')
    console.log('[LoginForm] Email:', email())
    console.log('[LoginForm] Password length:', password().length)

    await preSendValidate(email(), 'email')
    await preSendValidate(password(), 'password')

    setIsLinkSent(false)
    setSubmitError()

    if (Object.keys(validationErrors()).length > 0) {
      console.warn('[LoginForm] Ошибки валидации:', validationErrors())
      authFormRef.querySelector<HTMLInputElement>(`input[name="${Object.keys(validationErrors())[0]}"]`)?.focus()
      return
    }

    console.log('[LoginForm] Валидация прошла успешно, отправляем запрос')
    setIsSubmitting(true)

    try {
      console.log('[LoginForm] Вызываем signIn...')
      const success = await signIn({ email: email(), password: password() })
      console.log('[LoginForm] Результат signIn:', success)

      if (success) {
        console.log('[LoginForm] Авторизация успешна')
        hideModal()
        toast.success(t('Welcome!'))
      } else {
        console.warn('[LoginForm] Авторизация не удалась, authError:', authError())
        switch (authError()) {
          case 'user has not signed up email & password':
          case 'bad user credentials': {
            setValidationErrors((prev) => ({
              ...prev,
              password: t('Something went wrong, check email and password')
            }))
            break
          }
          case 'user not found': {
            setValidationErrors((prev) => ({ ...prev, email: t('User was not found') }))
            break
          }
          case 'email not verified': {
            setValidationErrors((prev) => ({ ...prev, email: t('This email is not verified') }))
            break
          }
          default:
            setSubmitError(
              <div class={styles.info}>
                {t('Error', authError())}
                {'. '}
                <span class={'link'} onClick={handleSendLinkAgainClick}>
                  {t('Send link again')}
                </span>
              </div>
            )
        }
      }
    } catch (error) {
      console.error('[LoginForm] Ошибка в handleSubmit:', error)
      setSubmitError(authError())
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} class={styles.authForm} ref={(el) => (authFormRef = el)}>
      <div>
        <AuthModalHeader modalType="login" />
        <div
          class={clsx('pretty-form__item', {
            'pretty-form__item--error': validationErrors().email
          })}
        >
          <input
            id="email"
            name="email"
            autocomplete="email"
            type="email"
            value={email()}
            placeholder={t('Email')}
            onInput={(event) => handleEmailInput(event.currentTarget.value)}
          />
          <label for="email">{t('Email')}</label>
          <Show when={validationErrors().email}>
            <div class={styles.validationError}>{validationErrors().email}</div>
          </Show>
        </div>

        <PasswordField
          variant={'login'}
          setError={validationErrors().password}
          onBlur={(value) => handlePasswordInput(value)}
        />

        <Show when={submitError()}>
          <div class={clsx('form-message--error', styles.validationError)}>{submitError()}</div>
        </Show>

        <div>
          <button class={clsx('button', styles.submitButton)} disabled={isSubmitting()} type="submit">
            {isSubmitting() ? '...' : t('Enter')}
          </button>
        </div>
        <div class={styles.authActions}>
          <span
            class="link"
            onClick={() =>
              setSearchParams({
                mode: 'send-reset-link'
              })
            }
          >
            {t('Forgot password?')}
          </span>
        </div>
      </div>

      <div>
        <SocialProviders />

        <div class={styles.authControl}>
          <span
            class={styles.authLink}
            onClick={() =>
              setSearchParams({
                mode: 'register'
              })
            }
          >
            {t('I have no account yet')}
          </span>
        </div>
      </div>
    </form>
  )
}
