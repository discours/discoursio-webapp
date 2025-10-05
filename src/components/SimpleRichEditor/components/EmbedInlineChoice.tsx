/**
 * @module SimpleRichEditor/components/EmbedInlineChoice
 * @description Компактный inline выбор типа вставки для embed (без модалки)
 */

import { Component, createResource, createSignal, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import styles from './EmbedInlineChoice.module.scss'

interface Props {
  url: string
  platform: string
  onChoice: (type: 'link' | 'embed') => void
  onCancel: () => void
}

/**
 * Компактный inline выбор для вставки embed
 * Превью показывается только при hover на кнопку "With preview"
 */
export const EmbedInlineChoice: Component<Props> = (props) => {
  const { t } = useLocalize()
  const [showPreview, setShowPreview] = createSignal(false)

  // Загружаем превью лениво (только когда hover)
  const [embedPreview] = createResource(
    () => showPreview() && { url: props.url, platform: props.platform },
    async ({ url, platform }) => {
      try {
        const { createUniversalEmbed } = await import('../media/html')
        return await createUniversalEmbed(url, platform)
      } catch {
        return null
      }
    }
  )

  return (
    <div class={styles.embedChoice}>
      {/* Компактный выбор */}
      <div class={styles.actions}>
        <div class={styles.buttonWithPreview}>
          <button
            type="button"
            class={styles.actionButton}
            onClick={() => props.onChoice('embed')}
            onMouseEnter={() => setShowPreview(true)}
            onMouseLeave={() => setShowPreview(false)}
            title={t('Insert as embed with preview')}
          >
            📺 {t('With preview')}
          </button>

          {/* Tooltip превью при hover */}
          <Show when={showPreview() && embedPreview() && !embedPreview.loading}>
            <div class={styles.previewTooltip} innerHTML={embedPreview() || ''} />
          </Show>
        </div>

        <button
          type="button"
          class={styles.actionButton}
          onClick={() => props.onChoice('link')}
          title={t('Insert as regular link')}
        >
          🔗 {t('Simple link')}
        </button>
        <button type="button" class={styles.cancelButton} onClick={props.onCancel} title={t('Cancel')}>
          ×
        </button>
      </div>
    </div>
  )
}
