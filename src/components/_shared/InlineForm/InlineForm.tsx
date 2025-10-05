import { clsx } from 'clsx'
import { createEffect, createResource, createSignal, onMount, Show } from 'solid-js'

import { Icon } from '~/components/_shared/Icon'
import { Popover } from '~/components/_shared/Popover'
import { useLocalize } from '~/context/localize'

import styles from './InlineForm.module.scss'

/**
 * Получает favicon для URL
 */
const getFaviconUrl = (url: string): string => {
  try {
    const urlObj = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
  } catch {
    return ''
  }
}

type Props = {
  onClose: () => void
  onBlur?: (event: FocusEvent) => void
  onClear?: () => void
  onSubmit: (value: string, asPlainText?: boolean) => void
  validate?: (value: string) => string | Promise<string>
  initialValue?: string
  showInput?: boolean
  placeholder: string
  onFocus?: (event: FocusEvent) => void
  supportPlainText?: boolean // Поддержка вставки как plain text через Shift+Enter
}

export const InlineForm = (props: Props) => {
  const { t } = useLocalize()
  const [formValue, setFormValue] = createSignal(props.initialValue || '')
  const [formValueError, setFormValueError] = createSignal<string | undefined>()
  const [inputRef, setInputRef] = createSignal<HTMLInputElement | undefined>()
  const [detectedPlatform, setDetectedPlatform] = createSignal<string>('')
  const [showPlatformBadge, setShowPlatformBadge] = createSignal(false)

  // Загружаем превью для embed
  const [embedPreview] = createResource(
    () => ({ url: formValue(), platform: detectedPlatform(), show: showPlatformBadge() }),
    async ({ url, platform, show }) => {
      if (!show || !url || platform === 'unknown') return null

      try {
        const { createUniversalEmbed } = await import('~/components/SimpleRichEditor/media/html')
        const html = await createUniversalEmbed(url, platform)
        return html
      } catch {
        return null
      }
    }
  )

  const handleFormInput = async (e: { currentTarget: HTMLInputElement; target: HTMLInputElement }) => {
    const value = (e.currentTarget || e.target).value
    setFormValueError()
    setFormValue(value)

    // Детектим платформу для embed формы
    if (props.supportPlainText && value.trim()) {
      try {
        // 🔒 Безопасное извлечение iframe src (только из whitelist доменов)
        let urlToDetect = value.trim()
        if (urlToDetect.includes('<iframe')) {
          const { getSafeEmbedUrl } = await import('~/components/SimpleRichEditor/media/embedMetadata')
          const safeUrl = await getSafeEmbedUrl(urlToDetect)
          if (safeUrl) {
            urlToDetect = safeUrl
            // Обновляем значение поля на безопасный URL
            setFormValue(safeUrl)
          } else {
            // ⚠️ Небезопасный iframe - показываем ошибку
            setFormValueError('Unsafe iframe source. Only trusted domains allowed.')
            setShowPlatformBadge(false)
            return
          }
        }

        const { detectEmbedPlatform } = await import('~/components/SimpleRichEditor/media/validation')
        const platform = detectEmbedPlatform(urlToDetect)

        if (platform !== 'unknown') {
          setDetectedPlatform(platform)
          setShowPlatformBadge(true)
        } else {
          // Для unknown URL проверяем безопасность
          const { isSafeEmbedDomain } = await import('~/components/SimpleRichEditor/media/embedMetadata')
          if (isSafeEmbedDomain(urlToDetect)) {
            setDetectedPlatform('embed')
            setShowPlatformBadge(true)
          } else {
            setShowPlatformBadge(false)
            setDetectedPlatform('')
          }
        }
      } catch {
        setShowPlatformBadge(false)
        setDetectedPlatform('')
      }
    } else {
      setShowPlatformBadge(false)
      setDetectedPlatform('')
    }
  }

  createEffect(() => {
    setFormValue(props.initialValue || '')
  })

  const handleSaveButtonClick = async (asPlainText = false) => {
    if (props.validate) {
      const errorMessage = await props.validate(formValue())
      if (errorMessage) {
        setFormValueError(errorMessage)
        return
      }
    }

    props.onSubmit(formValue(), asPlainText)
    props.onClose()
  }

  const handleKeyDown = async (e: KeyboardEvent) => {
    setFormValueError('')

    if (e.key === 'Enter') {
      e.preventDefault()
      // Shift+Enter = вставить как простой текст (только если supportPlainText=true)
      const asPlainText = props.supportPlainText && e.shiftKey
      await handleSaveButtonClick(asPlainText)
    }

    if (e.key === 'Escape' && props.onClear) {
      props.onClear()
    }
  }

  const handleClear = () => {
    props.initialValue && props.onClear?.()
    props.onClose()
  }

  onMount(() => inputRef()?.focus())

  return (
    <div class={styles.InlineForm}>
      <div class={styles.form}>
        <input
          ref={setInputRef}
          type="text"
          value={formValue()}
          placeholder={props.placeholder}
          onKeyDown={handleKeyDown}
          onInput={handleFormInput}
          onFocus={props.onFocus}
        />
        {/* Favicon badge вместо иконки */}
        <Show when={showPlatformBadge() && formValue()}>
          <div class={clsx(styles.platformBadge, { [styles.visible]: showPlatformBadge() })}>
            <Show when={getFaviconUrl(formValue())} fallback={<Icon name="editor-link" />}>
              <img src={getFaviconUrl(formValue())} alt="" width="16" height="16" style={{ 'border-radius': '2px' }} />
            </Show>
            <span>{detectedPlatform()}</span>
          </div>
        </Show>
        <Popover content={t('Add link')}>
          {(triggerRef: (el: HTMLElement) => void) => (
            <button
              ref={triggerRef}
              type="button"
              onClick={() => handleSaveButtonClick(false)}
              disabled={Boolean(formValueError())}
            >
              <Icon name="status-done" />
            </button>
          )}
        </Popover>
        <Popover content={props.initialValue ? t('Remove link') : t('Cancel')}>
          {(triggerRef: (el: HTMLElement) => void) => (
            <button ref={triggerRef} type="button" onClick={handleClear}>
              {props.initialValue ? <Icon name="editor-unlink" /> : <Icon name="status-cancel" />}
            </button>
          )}
        </Popover>
      </div>

      <div class={clsx(styles.linkError, { [styles.visible]: Boolean(formValueError()) })}>
        {formValueError() ||
          (props.supportPlainText && (
            <span style={{ 'font-size': '11px', color: '#666' }}>Shift+Enter for plain text</span>
          ))}
      </div>

      {/* Превью embed */}
      <Show when={embedPreview() && !embedPreview.loading}>
        <div class={styles.embedPreview} innerHTML={embedPreview() || ''} />
      </Show>
    </div>
  )
}
