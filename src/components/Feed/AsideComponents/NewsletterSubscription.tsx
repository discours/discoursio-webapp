import { createSignal } from 'solid-js'
import { AsideSection } from '~/components/Feed/AsideComponents/AsideSection'
import { Icon } from '~/components/_shared/Icon'
import { useLocalize } from '~/context/localize'
import styles from './NewsletterSubscription.module.scss'

export interface NewsletterSubscriptionProps {
  title?: string
  description?: string
  collapsible?: boolean
}

export const NewsletterSubscription = (props: NewsletterSubscriptionProps) => {
  const { t } = useLocalize()
  const [email, setEmail] = createSignal('')
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  const [isSubscribed, setIsSubscribed] = createSignal(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!email() || isSubmitting()) return

    setIsSubmitting(true)

    try {
      // TODO: Интеграция с API подписки
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Имитация запроса
      setIsSubscribed(true)
    } catch (error) {
      console.error('Newsletter subscription error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AsideSection
      collapsible={props.collapsible} 
      buttonVariant="outline"
      buttonSize="M"
      icon="mail"
      class={styles.newsletterSection}
    >
      <div class={styles.newsletterCard}>
        {/* Фоновое изображение конверта */}
        <div class={styles.newsletterBackground}>
          <div class={styles.envelopeIcon}>
            <Icon name="mail" class={styles.mailIcon} />
          </div>
        </div>

        <div class={styles.newsletterContent}>
          <p class={styles.newsletterDescription}>
            {props.description ||
              t(
                'Subscribe to the newsletter of the best publications to receive a digest of the main materials'
              )}
          </p>

          {isSubscribed() ? (
            <div class={styles.successMessage}>
              <Icon name="check-circle" class={styles.successIcon} />
              <span>{t('Successfully subscribed!')}</span>
            </div>
          ) : (
            <form class={styles.newsletterForm} onSubmit={handleSubmit}>
              <div class={styles.inputWrapper}>
                <input
                  type="email"
                  placeholder={t('Enter Email')}
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  class={styles.emailInput}
                  disabled={isSubmitting()}
                  required
                />
                <button
                  type="submit"
                  class={styles.submitButton}
                  disabled={!email() || isSubmitting()}
                  aria-label={t('Subscribe')}
                >
                  <Icon name={isSubmitting() ? 'loader' : 'arrow-right'} class={styles.submitIcon} />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AsideSection>
  )
}
