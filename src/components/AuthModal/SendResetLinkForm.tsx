import { useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { createSignal, JSX, onMount, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { validateEmail } from '~/utils/validate'
import styles from './AuthModal.module.scss'
import { email, setEmail } from './sharedLogic'

type FormFields = {
  email: string
}

type ValidationErrors = Partial<Record<keyof FormFields, string | JSX.Element>>

export const SendResetLinkForm = () => {
  const [, changeSearchParams] = useSearchParams()
  const { t } = useLocalize()
  const handleEmailInput = (newEmail: string) => {
    setValidationErrors(({ email: _notNeeded, ...rest }) => rest)
    setEmail(newEmail.toLowerCase())
  }
  const { forgotPassword } = useSession()
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  const [validationErrors, setValidationErrors] = createSignal<ValidationErrors>({})
  const [isUserNotFound, setIsUserNotFound] = createSignal(false)
  let authFormRef: HTMLFormElement
  const [message, setMessage] = createSignal<string>('')

  const handleSubmit = async (event: Event) => {
    event.preventDefault()
    setIsUserNotFound(false)
    const newValidationErrors: ValidationErrors = {}

    if (!email()) {
      newValidationErrors.email = t('Please enter email')
    } else if (!validateEmail(email())) {
      newValidationErrors.email = t('Invalid email')
    }

    setValidationErrors(newValidationErrors)
    const isValid = Object.keys(newValidationErrors).length === 0

    if (!isValid) {
      authFormRef
        ?.querySelector<HTMLInputElement>(`input[name="${Object.keys(newValidationErrors)[0]}"]`)
        ?.focus()

      return
    }

    setIsSubmitting(true)
    try {
      const result = await forgotPassword({
        email: email(),
        redirect_url: window?.location?.origin || ''
      })
      if (result) {
        setMessage(result || '')
      } else {
        console.warn('[SendResetLinkForm] forgot password mutation failed')
        setIsUserNotFound(false)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  onMount(() => {
    if (email()) {
      console.info('[SendResetLinkForm] email detected')
    }
  })

  return (
    <form
      onSubmit={handleSubmit}
      class={clsx(styles.authForm, styles.authFormForgetPassword)}
      ref={(el) => (authFormRef = el)}
    >
      <div>
        <h4>{t('Forgot password?')}</h4>
        <Show when={!message()}>
          <div class={styles.authSubtitle}>
            {t("It's OK. Just enter your email to receive a link to change your password")}
          </div>
        </Show>
        <div
          class={clsx('pretty-form__item', {
            'pretty-form__item--error': validationErrors().email
          })}
        >
          <input
            disabled={Boolean(message())}
            id="email"
            name="email"
            autocomplete="email"
            type="email"
            value={email()}
            placeholder={t('Email')}
            onChange={(event) => handleEmailInput(event.currentTarget.value)}
          />
          <label for="email">{t('Email')}</label>
          <Show when={isUserNotFound()}>
            <div class={styles.validationError}>
              {t("We can't find you, check email or")}{' '}
              <span
                class={'link'}
                onClick={() =>
                  changeSearchParams({
                    mode: 'register'
                  })
                }
              >
                {t('register')}
              </span>
            </div>
          </Show>
          <Show when={validationErrors().email}>
            <div class={styles.validationError}>{validationErrors().email}</div>
          </Show>
        </div>
        <Show when={!message()} fallback={<div class={styles.authSubtitle}>{t(message())}</div>}>
          <>
            <div style={{ 'margin-top': '5rem' }}>
              <button
                class={clsx('button', styles.submitButton)}
                disabled={isSubmitting() || Boolean(message())}
                type="submit"
              >
                {isSubmitting() ? '...' : t('Restore password')}
              </button>
            </div>
            <div class={styles.authControl}>
              <span
                class={styles.authLink}
                onClick={() =>
                  changeSearchParams({
                    mode: 'login'
                  })
                }
              >
                {t('I know the password')}
              </span>
            </div>
          </>
        </Show>
      </div>
    </form>
  )
}
