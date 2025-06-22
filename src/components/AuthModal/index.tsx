import { useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { Component, createEffect, createMemo, Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { useLocalize } from '~/context/localize'
import { ModalSource, useUI } from '~/context/ui'
import { isMobile } from '~/lib/mediaQuery'
import styles from './AuthModal.module.scss'
import { ChangePasswordForm } from './ChangePasswordForm'
import { EmailConfirm } from './EmailConfirm'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { SendEmailConfirm } from './SendEmailConfirm'
import { SendResetLinkForm } from './SendResetLinkForm'

export type AuthModalMode =
  | 'login'
  | 'register'
  | 'confirm-email'
  | 'send-confirm-email'
  | 'send-reset-link'
  | 'change-password'

export type AuthModalSearchParams = {
  mode: AuthModalMode
  source?: ModalSource
  token?: string
}

const AUTH_MODAL_MODES: Record<AuthModalMode, Component> = {
  login: LoginForm,
  register: RegisterForm,
  'send-reset-link': SendResetLinkForm,
  'confirm-email': EmailConfirm,
  'send-confirm-email': SendEmailConfirm,
  'change-password': ChangePasswordForm
}

export const AuthModal = () => {
  let rootRef: HTMLDivElement | null
  const { t } = useLocalize()
  const [searchParams] = useSearchParams<AuthModalSearchParams>()
  const { hideModal } = useUI()
  const mode = createMemo(() => {
    return (
      AUTH_MODAL_MODES[searchParams?.mode as AuthModalMode] ? searchParams?.mode : 'login'
    ) as AuthModalMode
  })

  createEffect((oldMode) => {
    if (oldMode !== mode() && !isMobile()) {
      rootRef?.querySelector('input')?.focus()
    }
  }, null)

  return (
    <div
      ref={(el) => (rootRef = el)}
      class={clsx(styles.view, {
        row: !searchParams?.source,
        [styles.signUp]: mode() === 'register' || mode() === 'confirm-email'
      })}
    >
      <Show when={!searchParams?.source}>
        <div class={clsx('col-md-12', styles.authImage)}>
          <div
            class={styles.authImageText}
            classList={{ [styles.hidden]: mode() !== 'register' && mode() !== 'confirm-email' }}
          >
            <div>
              <h4>{t('Join the global community of authors!')}</h4>
              <p class={styles.authBenefits}>
                {t(
                  'Get to know the most intelligent people of our time, edit and discuss the articles, share your expertise, rate and decide what to publish in the magazine'
                )}
                . {t('New stories and more are waiting for you every day!')}
              </p>
            </div>
            <p class={styles.disclaimer}>
              {t('By signing up you agree with our')}{' '}
              <a
                href="/terms"
                onClick={() => {
                  hideModal()
                }}
              >
                {t('terms of use')}
              </a>
              , {t('to process personal data and receive email notifications')}.
            </p>
          </div>
        </div>{' '}
      </Show>
      <div
        class={clsx(styles.auth, {
          'col-md-12': !searchParams?.source
        })}
      >
        <Dynamic component={AUTH_MODAL_MODES[mode() as AuthModalMode]} />
      </div>
    </div>
  )
}
