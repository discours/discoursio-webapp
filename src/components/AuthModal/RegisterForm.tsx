import { clsx } from 'clsx'
import type { JSX } from 'solid-js'
import { Show, createMemo, createSignal } from 'solid-js'

import { useSearchParams } from '@solidjs/router'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'
import { validateEmail } from '~/utils/validate'
import { AuthModalHeader } from './AuthModalHeader'
import { PasswordField } from './PasswordField'
import { SocialProviders } from './SocialProviders'
import { email, setEmail } from './sharedLogic'

import styles from './AuthModal.module.scss'

type EmailStatus = 'not verified' | 'verified' | 'registered' | ''

type FormFields = {
  fullName: string
  email: string
  password: string
}

type ValidationErrors = Partial<Record<keyof FormFields, string | JSX.Element>>

export const RegisterForm = () => {
  const [, changeSearchParams] = useSearchParams()
  const { hideModal } = useUI()
  const { t } = useLocalize()
  const { signUp, isRegistered, resendVerifyEmail } = useSession()
  // FIXME: use submit error data or remove signal
  const [_submitError, setSubmitError] = createSignal('')
  const [fullName, setFullName] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  const [isSuccess, setIsSuccess] = createSignal(false)
  const [validationErrors, setValidationErrors] = createSignal<ValidationErrors>({})
  const [passwordError, setPasswordError] = createSignal<string>()
  const [emailStatus, setEmailStatus] = createSignal<string>('')

  let authFormRef: HTMLFormElement

  const handleNameInput = (newName: string) => {
    setFullName(newName)
  }

  const handleSubmit = async (event: Event) => {
    event.preventDefault()
    if (passwordError()) {
      setValidationErrors((errors) => ({ ...errors, password: passwordError() }))
    } else {
      setValidationErrors(({ password: _notNeeded, ...rest }) => rest)
    }
    setValidationErrors(({ email: _notNeeded, ...rest }) => rest)
    setValidationErrors(({ fullName: _notNeeded, ...rest }) => rest)
    setSubmitError('')

    const newValidationErrors: ValidationErrors = {}
    const cleanName = fullName().trim()
    const cleanEmail = email().trim()

    if (!cleanName) {
      newValidationErrors.fullName = t('Please enter a name to sign your comments and publication')
    }

    if (!cleanEmail) {
      newValidationErrors.email = t('Please enter email')
    } else if (!validateEmail(email())) {
      newValidationErrors.email = t('Invalid email')
    }

    if (!password()) {
      newValidationErrors.password = t('Please enter password')
    }

    setValidationErrors(newValidationErrors)

    const isValid = createMemo(() => Object.keys(newValidationErrors).length === 0)

    if (!isValid() && authFormRef) {
      authFormRef
        .querySelector<HTMLInputElement>(`input[name="${Object.keys(newValidationErrors)[0]}"]`)
        ?.focus()
      return
    }
    setIsSubmitting(true)
    try {
      const opts = {
        given_name: cleanName,
        email: cleanEmail,
        password: password(),
        confirm_password: password(),
        redirect_uri: window?.location?.origin || ''
      }
      const success = await signUp(opts)
      setIsSuccess(success)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const handleResendLink = async (_ev: any) => {
    const success: boolean = await resendVerifyEmail({ email: email() })
    setIsSuccess(success)
  }

  const handleCheckEmailStatus = (status: EmailStatus | string) => {
    switch (status) {
      case 'not verified': {
        setValidationErrors((prev) => ({
          ...prev,
          email: (
            <>
              {t('This email is not verified')},{' '}
              <span class="link" onClick={handleResendLink}>
                {t('resend confirmation link')}
              </span>
            </>
          )
        }))
        break
      }
      case 'verified': {
        setValidationErrors((_prev) => ({
          email: (
            <>
              {t('This email is registered')}. {t('try')}
              {', '}
              <span class="link" onClick={() => changeSearchParams({ mode: 'login' })}>
                {t('Enter').toLocaleLowerCase()}
              </span>
            </>
          )
        }))
        break
      }
      case 'registered': {
        setValidationErrors((prev) => ({
          ...prev,
          email: (
            <>
              {t('This email is registered')}
              {'. '}
              <span class="link" onClick={() => changeSearchParams({ mode: 'send-reset-link' })}>
                {t('Set the new password')}
              </span>
            </>
          )
        }))
        break
      }
      default: {
        console.info('[RegisterForm] email is not registered')
        break
      }
    }
  }

  const handleEmailBlur = async () => {
    if (validateEmail(email())) {
      const checkResult = await isRegistered(email())
      setEmailStatus(checkResult)
      handleCheckEmailStatus(checkResult)
    }
  }

  const handleEmailInput = (newEmail: string) => {
    setEmailStatus('')
    setValidationErrors({})
    setEmail(newEmail.toLowerCase())
  }

  return (
    <>
      <Show when={!isSuccess()}>
        <form onSubmit={handleSubmit} class={styles.authForm} ref={(el) => (authFormRef = el)}>
          <div>
            <AuthModalHeader modalType="register" />
            <div
              class={clsx('pretty-form__item', {
                'pretty-form__item--error': validationErrors().fullName
              })}
            >
              <input
                name="fullName"
                type="text"
                disabled={Boolean(emailStatus())}
                placeholder={t('Full name')}
                autocomplete="one-time-code"
                onChange={(event) => handleNameInput(event.currentTarget.value)}
              />
              <label for="name">{t('Full name')}</label>
              <Show when={validationErrors().fullName && !emailStatus()}>
                <div class={styles.validationError}>{validationErrors().fullName}</div>
              </Show>
            </div>

            <div
              class={clsx('pretty-form__item', {
                'pretty-form__item--error': validationErrors().email && !emailStatus()
              })}
            >
              <input
                id="email"
                name="email"
                autocomplete="one-time-code"
                type="email"
                placeholder={t('Email')}
                onInput={(event) => handleEmailInput(event.currentTarget.value)}
                onBlur={handleEmailBlur}
              />
              <label for="email">{t('Email')}</label>
              <Show when={validationErrors().email || emailStatus()}>
                <div class={clsx(styles.validationError, { info: Boolean(emailStatus()) })}>
                  {validationErrors().email}
                </div>
              </Show>
            </div>

            <PasswordField
              disableAutocomplete={true}
              disabled={Boolean(emailStatus())}
              errorMessage={(err) => !emailStatus() && setPasswordError(err)}
              onInput={(value) => setPassword(emailStatus() ? '' : value)}
            />

            <div>
              <button
                class={clsx('button', styles.submitButton)}
                disabled={isSubmitting() || Boolean(emailStatus())}
                type="submit"
              >
                {isSubmitting() ? '...' : t('Join')}
              </button>
            </div>
          </div>

          <div>
            <SocialProviders />

            <div class={styles.authControl}>
              <span
                class={styles.authLink}
                onClick={() =>
                  changeSearchParams({
                    mode: 'login'
                  })
                }
              >
                {t('I have an account')}
              </span>
            </div>
          </div>
        </form>
      </Show>
      <Show when={isSuccess()}>
        <div style={{ 'justify-content': 'center' }}>
          <div class={styles.title}>{t('Almost done! Check your email.')}</div>
          <div class={styles.text}>{t("We've sent you a message with a link to enter our website.")}</div>
          <div>
            <button class={clsx('button', styles.submitButton)} onClick={() => hideModal()}>
              {t('Back to main page')}
            </button>
          </div>
        </div>
      </Show>
    </>
  )
}
