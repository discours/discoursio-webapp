import { A } from '@solidjs/router'
import { Show } from 'solid-js'
import placeholderFeedImage from '~/assets/images/placeholder-feed.webp'
import { AsideSection } from '~/components/Feed/AsideComponents/AsideSection'
import { useLocalize } from '~/context/localize'

import styles from './FeedCustomization.module.scss'

export interface FeedCustomizationProps {
  title?: string
  description?: string
  collapsible?: boolean
  variant?: 'illustration' | 'image'
}

export const FeedCustomization = (props: FeedCustomizationProps) => {
  const { t } = useLocalize()
  const variant = props.variant || 'illustration'

  return (
    <AsideSection
      collapsible={props.collapsible} 
      buttonVariant="secondary"
      buttonSize="M"
      class={styles.customizeSection}
    >
      <Show
        when={variant === 'illustration'}
        fallback={
          <section class={styles.createFeedSection}>
            <div
              class={styles.createFeedBlock}
              style={{
                'background-image': `url(${placeholderFeedImage})`,
                'background-size': 'cover',
                'background-position': 'center',
                'background-repeat': 'no-repeat'
              }}
            >
              <div class={styles.createFeedContent}>
                <h3 class={styles.createFeedTitle}>{t('Create your feed')}</h3>
                <p class={styles.createFeedDescription}>
                  {props.description ||
                    t(
                      'Subscribe to interesting topics and authors to receive a personalized feed of publications'
                    )}
                </p>
                <A href="/settings/subs" class={styles.createFeedButton}>
                  {t('Customize feed')}
                </A>
              </div>
            </div>
          </section>
        }
      >
        <div class={styles.customizeCard}>
          <div class={styles.customizeBackground} />

          <div class={styles.archerIllustration}>
            <div class={styles.archer}>
              <div class={styles.bow} />
              <div class={styles.arrow} />
              <div class={styles.target} />
            </div>
          </div>

          <div class={styles.customizeContent}>
            <h3 class={styles.customizeTitle}>{t('Hit the target')}</h3>
            <p class={styles.customizeDescription}>
              {props.description || t('Fine-tune your feed to get exactly the content you want to read')}
            </p>
            <A href="/settings/subs" class={styles.customizeButton}>
              {t('Customize feed')}
            </A>
          </div>
        </div>
      </Show>
    </AsideSection>
  )
}
