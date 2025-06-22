import { useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { createSignal, JSX, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'
import styles from './AuthModal.module.scss'
import { PasswordField } from './PasswordField'

type FormFields = {
  password: string
}

type ValidationErrors = Partial<Record<keyof FormFields, string | JSX.Element>>

export const ChangePasswordForm = () => {
  const [searchParams, changeSearchParams] = useSearchParams<{ token?: string }>()
  const { hideModal } = useUI()
  const { t } = useLocalize()
  const { changePassword } = useSession()
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  const [validationErrors, setValidationErrors] = createSignal<ValidationErrors>({})
  const [newPassword, setNewPassword] = createSignal<string>('')
  const [passwordError, setPasswordError] = createSignal<string>('')
  const [isSuccess, setIsSuccess] = createSignal(false)
  let authFormRef: HTMLFormElement | undefined

  const handleSubmit = async (event: Event) => {
    event.preventDefault()
    setIsSubmitting(true)
    if (!newPassword()) return
    if (searchParams?.token) changePassword(newPassword(), searchParams.token)
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSuccess(true)
    }, 1000)
  }

  const handlePasswordInput = (value: string) => {
    setNewPassword(value)
    if (passwordError()) {
      setValidationErrors((errors) => ({ ...errors, password: passwordError() }))
    } else {
      setValidationErrors(({ password: _notNeeded, ...rest }) => rest)
    }
  }

  return (
    <>
      <Show when={!isSuccess()}>
        <form
          onSubmit={handleSubmit}
          class={clsx(styles.authForm, styles.authFormForgetPassword)}
          ref={(el) => (authFormRef = el)}
        >
          <div>
            <h4>{t('Enter a new password')}</h4>
            <Show when={validationErrors()}>
              <div>{validationErrors().password}</div>
            </Show>
            <PasswordField
              errorMessage={(err) => setPasswordError(err)}
              onInput={(value) => handlePasswordInput(value)}
            />

            <div>
              <button class={clsx('button', styles.submitButton)} disabled={isSubmitting()} type="submit">
                {isSubmitting() ? '...' : t('Change password')}
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
                {t('Cancel')}
              </span>
            </div>
          </div>
        </form>
      </Show>
      <Show when={isSuccess()}>
        <div class={styles.title}>{t('Password updated!')}</div>
        <div class={styles.text}>{t('You can now login using your new password')}</div>
        <div>
          <button
            class={clsx('button', styles.submitButton)}
            onClick={() => changeSearchParams({ mode: 'login' })}
          >
            {t('Enter')}
          </button>
          <button class={clsx('button', styles.submitButton)} onClick={() => hideModal()}>
            {t('Back to main page')}
          </button>
        </div>
      </Show>
    </>
  )
}
