/**
 * @module SimpleRichEditor/modals/EmbedChoiceModal
 * @description Модальное окно выбора типа вставки для embed платформ
 */

import { Component, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import styles from './EmbedChoiceModal.module.scss'

/**
 * Модальное окно для выбора типа вставки embed-ссылки
 *
 * Показывается когда пользователь вставляет URL embed платформы
 * (YouTube, Vimeo, Facebook, и т.д.)
 */
export const EmbedChoiceModal: Component = () => {
  const { t } = useLocalize()
  const { modalCallbacks } = useUI()

  const data = () => modalCallbacks()?.data
  const url = () => data()?.url || ''
  const platform = () => data()?.platform || 'unknown'

  const onChoice = (type: 'link' | 'embed') => {
    modalCallbacks()?.onSuccess?.(type)
  }

  const onCancel = () => {
    modalCallbacks()?.onCancel?.()
  }

  // Названия платформ
  const platformNames: Record<string, string> = {
    youtube: 'YouTube',
    vimeo: 'Vimeo',
    facebook: 'Facebook',
    x: 'X (Twitter)',
    instagram: 'Instagram',
    soundcloud: 'SoundCloud',
    bandcamp: 'Bandcamp',
    telegram: 'Telegram',
    reddit: 'Reddit',
    tiktok: 'TikTok',
    twitch: 'Twitch',
    ted: 'TED',
    wikipedia: 'Wikipedia',
    slideshare: 'SlideShare',
    imgur: 'Imgur',
    flickr: 'Flickr',
    discours: 'Discours'
  }

  const platformName = () => platformNames[platform()] || platform()

  return (
    <Show when={url()}>
      <div class={styles.overlay} onClick={onCancel}>
        <div class={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div class={styles.header}>
            <h3>{t('How to insert this link?')}</h3>
            <button type="button" class={styles.closeButton} onClick={onCancel}>
              ×
            </button>
          </div>

          <div class={styles.content}>
            <div class={styles.platformInfo}>
              <div class={styles.platformName}>{platformName()}</div>
              <div class={styles.url}>{url()}</div>
            </div>

            <div class={styles.choices}>
              <button type="button" class={styles.choiceButton} onClick={() => onChoice('link')}>
                <div class={styles.choiceIcon}>🔗</div>
                <div class={styles.choiceTitle}>{t('Regular link')}</div>
                <div class={styles.choiceDescription}>{t('Insert as a regular clickable link')}</div>
              </button>

              <button type="button" class={styles.choiceButton} onClick={() => onChoice('embed')}>
                <div class={styles.choiceIcon}>📺</div>
                <div class={styles.choiceTitle}>{t('Embed with preview')}</div>
                <div class={styles.choiceDescription}>{t('Show content preview in the article')}</div>
              </button>
            </div>

            <div class={styles.hint}>💡 {t('You can change this later by editing the link')}</div>
          </div>
        </div>
      </div>
    </Show>
  )
}
