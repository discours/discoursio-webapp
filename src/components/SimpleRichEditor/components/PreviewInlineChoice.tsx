/**
 * @module SimpleRichEditor/components/PreviewInlineChoice
 * @description Компактный inline выбор типа вставки для embed (без модалки)
 */

import { Component, createSignal, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { createUniversalEmbed } from '../media/html'
import styles from './PreviewInlineChoice.module.scss'

interface Props {
  url: string
  platform: string
  onChoice: (type: 'link' | 'preview' | 'text') => void
  onCancel: () => void
}

/**
 * Компактный inline выбор для вставки embed
 * Превью показывается только при hover на кнопку "With preview"
 */
export const PreviewInlineChoice: Component<Props> = (props) => {
  const { t } = useLocalize()
  const [showPreview, setShowPreview] = createSignal(false)
  const [previewHtml, setPreviewHtml] = createSignal<string>('')

  // Проверяем, можем ли мы создать embed
  // Переиспользуем логику: если платформа известна (не 'unknown'), значит можем
  const canCreateEmbed = () => {
    // unknown платформа - не можем создать embed
    if (props.platform === 'unknown') return false

    // Для всех известных платформ из detectEmbedPlatform можем создать embed
    // Полный список: youtube, vimeo, twitch, ted, soundcloud, bandcamp, facebook, x,
    // instagram, telegram, reddit, tiktok, wikipedia, slideshare, imgur, flickr, discours
    return true
  }

  // Генерируем превью асинхронно при первом hover
  // Переиспользуем createUniversalEmbed для генерации превью
  const generatePreview = async () => {
    if (previewHtml()) return // Уже сгенерировано

    console.log('[PreviewInlineChoice] Generating preview for:', props.url, 'platform:', props.platform)

    try {
      const html = await createUniversalEmbed(props.url, props.platform)
      console.log('[PreviewInlineChoice] createUniversalEmbed returned:', html)

      if (html) {
        // Если это <preview> тег (для видео), конвертируем в iframe для превью
        if (html.includes('<preview>')) {
          console.log('[PreviewInlineChoice] Converting preview tag to iframe')
          const { processPreviewTags } = await import('../media/previewRenderer')
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = html
          console.log('[PreviewInlineChoice] tempDiv before processPreviewTags:', tempDiv.innerHTML)
          await processPreviewTags(tempDiv)
          console.log('[PreviewInlineChoice] tempDiv after processPreviewTags:', tempDiv.innerHTML)
          setPreviewHtml(tempDiv.innerHTML)
        } else {
          setPreviewHtml(html)
        }
      } else {
        // Fallback - простое текстовое превью
        setPreviewHtml(`<div style="padding: 16px; text-align: center; color: #666; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="font-weight: 500; margin-bottom: 4px;">${props.platform.toUpperCase()}</div>
          <div style="font-size: 13px; color: #9ca3af; word-break: break-all;">${props.url}</div>
        </div>`)
      }
    } catch (error) {
      console.error('[PreviewInlineChoice] Failed to generate preview:', error)
      setPreviewHtml(`<div style="padding: 16px; text-align: center; color: #666;">Preview unavailable</div>`)
    }
  }

  // Обработчик hover - генерируем превью
  const handleMouseEnter = () => {
    setShowPreview(true)
    void generatePreview()
  }

  return (
    <div class={styles.embedChoice}>
      {/* Компактный выбор */}
      <div class={styles.actions}>
        {/* Кнопка "Превью" показывается только если можем создать preview */}
        <Show when={canCreateEmbed()}>
          <div class={styles.buttonWithPreview}>
            <button
              type="button"
              class={styles.actionButton}
              onClick={() => {
                console.log('[PreviewInlineChoice] Preview button clicked')
                props.onChoice('preview')
              }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={() => setShowPreview(false)}
            >
              {t('Preview')}
            </button>

            {/* Tooltip превью при hover - используем previewHtml из createUniversalEmbed */}
            <Show when={showPreview() && previewHtml()}>
              <div class={styles.previewTooltip} innerHTML={previewHtml()} />
            </Show>
          </div>
        </Show>

        {/* Кнопка "Ссылка" показывается всегда */}
        <button
          type="button"
          class={styles.actionButton}
          onClick={() => {
            console.log('[PreviewInlineChoice] Link button clicked')
            props.onChoice('link')
          }}
          title={t('Insert as hyperlink')}
        >
          {t('Link')}
        </button>

        {/* Кнопка "Текст" показывается всегда */}
        <button
          type="button"
          class={styles.actionButton}
          onClick={() => {
            console.log('[PreviewInlineChoice] Text button clicked')
            props.onChoice('text')
          }}
          title={t('Insert as plain text')}
        >
          {t('Text')}
        </button>

        <button type="button" class={styles.cancelButton} onClick={props.onCancel} title={t('Cancel')}>
          ×
        </button>
      </div>

      {/* Показываем URL под кнопками */}
      <div class={styles.urlDisplay}>{props.url}</div>
    </div>
  )
}
