import { createSignal, JSX, Show } from 'solid-js'

import { toast } from 'solid-sonner'
import { useLocalize } from '~/context/localize'
import { validateEmail } from '~/utils/validate'
import { Button } from '../Button'
import { Icon } from '../Icon'

import styles from './Newsletter.module.scss'

type Props = {
  variant?: 'mobileSubscription'
}
export const Newsletter = (props: Props) => {
  const { t } = useLocalize()

  const [title, setTitle] = createSignal('')
  const [email, setEmail] = createSignal('')
  const [emailError, setEmailError] = createSignal<string>('')

  const validate = (): boolean => {
    if (!email()) {
      setEmailError(t('Please enter email'))
      return false
    }

    if (!validateEmail(email())) {
      setEmailError(t('Please check your email address'))
      return false
    }

    setEmailError('')
    return true
  }

  const handleInput: JSX.ChangeEventHandlerUnion<HTMLInputElement, Event> = (event) => {
    setEmailError('')
    setEmail(event.target.value)
  }

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault()

    if (!validate()) return

    setTitle(t('Subscribing...'))

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: email() })
    }

    const response = await fetch('/api/newsletter', requestOptions)

    if (response.ok) {
      setTitle(t('Following'))
      toast.success(t('Thank you for subscribing'))
    } else {
      if (response.status === 400) {
        setEmailError(t('Please check your email address'))
      } else {
        setEmailError(t('Something went wrong, please try again'))
      }

      setTitle('')
    }
  }

  return (
    <form
      class={props.variant === 'mobileSubscription' ? styles.mobileSubscription : styles.form}
      onSubmit={handleSubmit}
      novalidate
    >
      <Show when={!title()} fallback={title()}>
        <Show
          when={props.variant === 'mobileSubscription'}
          fallback={
            <div class={styles.controls}>
              <input
                type="email"
                name="email"
                value={email()}
                onInput={handleInput}
                class={styles.input}
                placeholder={t('Fill email')}
              />
              <Button class={styles.button} type="submit" variant="secondary" value={t('Subscribe')} />
            </div>
          }
        >
          <div class="pretty-form__item">
            <input
              value={email()}
              onInput={handleInput}
              type="email"
              placeholder={t('Your email')}
              id="subscription-email"
            />
            <label for="subscription-email">{t('Your email')}</label>
            <button type="submit" class={styles.mobileSubscriptionSubmit}>
              <Icon name="arrow-right" />
            </button>
          </div>
          <div class="description">{t('Subscribe to the best publications newsletter')}</div>
        </Show>
        <Show when={emailError()}>
          <div class={styles.error}>{emailError()}</div>
        </Show>
      </Show>
    </form>
  )
}
