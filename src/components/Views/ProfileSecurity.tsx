import { clsx } from 'clsx'
import { Show, createEffect, createSignal, on } from 'solid-js'
import { AuthGuard } from '~/components/AuthGuard'
import { PasswordField } from '~/components/AuthModal/PasswordField'
import { ProfileSettingsNavigation } from '~/components/ProfileNav'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import { Loading } from '~/components/_shared/Loading'
import { useLocalize } from '~/context/localize'
import { UpdateProfileInput, useSession } from '~/context/session'
import { DEFAULT_HEADER_OFFSET, useUI } from '~/context/ui'
import { validateEmail } from '~/utils/validate'

import toast from 'solid-toast'
import styles from '~/styles/views/ProfileSettings.module.scss'

type FormField = 'oldPassword' | 'newPassword' | 'newPasswordConfirm' | 'email'
type FormData = Record<FormField, string | undefined>

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const ProfileSecurityView = (_props: any) => {
  const { t } = useLocalize()
  const { updateProfile, session, isSessionLoaded } = useSession()
  const { showConfirm } = useUI()
  const [newPasswordError, setNewPasswordError] = createSignal<string | undefined>()
  const [oldPasswordError, setOldPasswordError] = createSignal<string | undefined>()
  const [emailError, setEmailError] = createSignal<string | undefined>()
  const [isSubmitting, setIsSubmitting] = createSignal<boolean>()
  const [isFloatingPanelVisible, setIsFloatingPanelVisible] = createSignal(false)

  // Мок-данные для привязанных соцсетей (позже заменить на реальные данные из session)
  const [connectedSocials, setConnectedSocials] = createSignal(['google', 'telegram']) // Примет данные из API

  // TODO: Реализовать реальную логику работы с OAuth провайдерами:
  // 1. Получать список подключенных соцсетей из session.author.socialNetworks или API
  // 2. При подключении - вызывать OAuth flow для конкретного провайдера (core.discours.io/oauth/[provider])
  // 3. При отключении - вызывать API для удаления связи (core.discours.io/oauth/[provider]/disconnect)
  // 4. Обновлять состояние через мутацию GraphQL или перезагрузку сессии
  // Сейчас используются моки для демонстрации UI

  const getSocialNetworkStatus = (network: string) => {
    return connectedSocials().includes(network)
  }

  const handleSocialClick = async (network: string, isConnected: boolean) => {
    if (isConnected) {
      // Обработка отвязывания
      const isConfirmed = await showConfirm({
        confirmBody: t('Are you sure you want to disconnect this social network?'),
        confirmButtonVariant: 'primary',
        declineButtonVariant: 'secondary'
      })

      if (isConfirmed) {
        // Здесь будет API вызов для отвязывания
        setConnectedSocials((prev) => prev.filter((item) => item !== network))
        toast.success(t('Social network disconnected successfully'))
      }
    } else {
      // Обработка привязывания
      // Здесь будет редирект на OAuth или другая логика привязки
      console.log(`Connecting ${network}...`)
      toast.success(t('Redirecting to {{network}} authorization', { network }))
    }
  }

  const renderSocialButton = (network: string, iconName: string, displayName: string) => {
    const isConnected = getSocialNetworkStatus(network)
    return (
      <button
        class={clsx(styles.socialButton, { [styles.connected]: isConnected })}
        type="button"
        title={isConnected ? `${t('Disconnect')} ${displayName}` : `${t('Connect')} ${displayName}`}
        onClick={() => handleSocialClick(network, isConnected)}
      >
        <Icon name={iconName} class={styles.icon} />
        <span class={styles.connectText}>{isConnected ? t('Connected') : t('Attach')}</span>
      </button>
    )
  }

  const initialState = {
    oldPassword: undefined,
    newPassword: undefined,
    newPasswordConfirm: undefined,
    email: undefined
  } as FormData

  const [formData, setFormData] = createSignal(initialState)
  let oldPasswordRef: HTMLDivElement | undefined
  let newPasswordRepeatRef: HTMLDivElement | undefined

  createEffect(
    on(
      () => session()?.author?.email,
      (email) => {
        setFormData((prevData: FormData) => ({ ...prevData, email }) as FormData)
      }
    )
  )
  const handleInputChange = (name: FormField, value: string) => {
    if (
      name === 'email' ||
      (name === 'newPasswordConfirm' && value && value?.length > 0 && !emailError() && !newPasswordError())
    ) {
      setIsFloatingPanelVisible(true)
    } else {
      setIsFloatingPanelVisible(false)
    }
    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }))
  }

  const handleCancel = async () => {
    const isConfirmed = await showConfirm({
      confirmBody: t('Do you really want to reset all changes?'),
      confirmButtonVariant: 'primary',
      declineButtonVariant: 'secondary'
    })
    if (isConfirmed) {
      setEmailError()
      setFormData({
        ...initialState,
        ['email']: session()?.author?.email || undefined
      })
      setIsFloatingPanelVisible(false)
    }
  }
  const handleChangeEmail = (_value: string) => {
    if (formData() && !validateEmail(formData()['email'] || '')) {
      setEmailError(t('Invalid email'))
      return
    }
  }
  const handleCheckNewPassword = (value: string) => {
    handleInputChange('newPasswordConfirm', value)
    if (newPasswordRepeatRef && value !== formData()['newPassword']) {
      const rect = newPasswordRepeatRef.getBoundingClientRect()
      const topPosition = (window?.scrollY || 0) + rect.top - DEFAULT_HEADER_OFFSET * 2
      window?.scrollTo({
        top: topPosition,
        left: 0,
        behavior: 'smooth'
      })
      toast.error(t('Incorrect new password confirm'))
      setNewPasswordError(t('Passwords are not equal'))
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)

    const options: UpdateProfileInput = {
      old_password: formData()['oldPassword'],
      new_password: formData()['newPassword'] || formData()['oldPassword'],
      confirm_new_password: formData()['newPassword'] || formData()['oldPassword'],
      email: formData()['email']
    }

    try {
      const result = await updateProfile(options)
      if (result) {
        // FIXME: const { errors } = result
        if (oldPasswordRef) {
          // && errors.some((obj: Error) => obj.message === 'incorrect old password')) {
          setOldPasswordError(t('Incorrect old password'))
          toast.error(t('Incorrect old password'))
          const rect = oldPasswordRef.getBoundingClientRect()
          const topPosition = (window?.scrollY || 0) + rect.top - DEFAULT_HEADER_OFFSET * 2
          window?.scrollTo({
            top: topPosition,
            left: 0,
            behavior: 'smooth'
          })
          setIsFloatingPanelVisible(false)
        }
        return
      }
      toast.error(t('Profile successfully saved'))
    } catch (error) {
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }
  return (
    <AuthGuard>
      <Show when={isSessionLoaded()} fallback={<Loading />}>
        <div class="wide-container">
          <div class="row">
            <div class="col-md-5">
              <div class={clsx('left-navigation', styles.leftNavigation)}>
                <ProfileSettingsNavigation />
              </div>
            </div>

            <div class="col-md-19">
              <div class="row">
                <div class="col-md-20 col-lg-18 col-xl-16">
                  <h1>{t('Login and security')}</h1>
                  <p class="description">{t('Settings for account, email, password and login methods.')}</p>

                  <form>
                    <h4>{t('Email')}</h4>
                    <div class="pretty-form__item">
                      <input
                        type="text"
                        name="email"
                        id="email"
                        disabled={isSubmitting()}
                        value={formData()['email'] || ''}
                        placeholder={t('Email')}
                        onFocus={() => setEmailError()}
                        onInput={(event) => handleChangeEmail(event.target.value)}
                      />
                      <label for="email">{t('Email')}</label>
                      <Show when={emailError()}>
                        <div
                          class={clsx(styles.emailValidationError, {
                            'form-message--error': emailError()
                          })}
                        >
                          {emailError()}
                        </div>
                      </Show>
                    </div>

                    <h4>{t('Change password')}</h4>
                    <h5>{t('Current password')}</h5>

                    <div ref={(el: HTMLDivElement) => (oldPasswordRef = el)}>
                      <PasswordField
                        onFocus={() => setOldPasswordError()}
                        setError={oldPasswordError()}
                        onInput={(value: string) => handleInputChange('oldPassword', value)}
                        value={formData()['oldPassword'] || undefined}
                        disabled={isSubmitting()}
                      />
                    </div>

                    <h5>{t('New password')}</h5>
                    <PasswordField
                      onInput={(value: string) => {
                        handleInputChange('newPassword', value)
                        handleInputChange('newPasswordConfirm', '')
                      }}
                      value={formData()['newPassword'] ?? ''}
                      disabled={isSubmitting()}
                      disableAutocomplete={true}
                    />

                    <h5>{t('Confirm your new password')}</h5>
                    <div ref={(el) => (newPasswordRepeatRef = el)}>
                      <PasswordField
                        noValidate={true}
                        value={formData?.()['newPasswordConfirm']}
                        onFocus={() => setNewPasswordError()}
                        setError={newPasswordError()}
                        onInput={handleCheckNewPassword}
                        disabled={isSubmitting()}
                        disableAutocomplete={true}
                      />
                    </div>
                    <h4>{t('Social networks')}</h4>
                    <div class={styles.socialNetworks}>
                      {renderSocialButton('google', 'google', 'Google')}
                      {renderSocialButton('vk', 'vk', 'VK')}
                      {renderSocialButton('facebook', 'facebook', 'Facebook')}
                      {renderSocialButton('telegram', 'telegram', 'Telegram')}
                      {renderSocialButton('twitter', 'twitter', 'X')}
                      {renderSocialButton('github', 'github', 'GitHub')}
                      {renderSocialButton('yandex', 'yandex', 'Yandex')}
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Show>

      <Show when={isFloatingPanelVisible() && !emailError() && !newPasswordError()}>
        <div class={styles.formActions}>
          <div class="wide-container">
            <div class="row">
              <div class="col-md-19 offset-md-5">
                <div class="row">
                  <div class="col-md-20 col-lg-18 col-xl-16">
                    <div class={styles.content}>
                      <Button
                        class={styles.cancel}
                        variant="light"
                        value={<span class={styles.cancelLabel}>{t('Clear')}</span>}
                        onClick={handleCancel}
                      />
                      <Button
                        onClick={handleSubmit}
                        variant="primary"
                        disabled={isSubmitting()}
                        value={isSubmitting() ? t('Saving...') : t('Save settings')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </AuthGuard>
  )
}
