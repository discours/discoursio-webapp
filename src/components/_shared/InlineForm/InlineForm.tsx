import { clsx } from 'clsx'
import { createEffect, createSignal, onMount, Show } from 'solid-js'

import { Icon } from '~/components/_shared/Icon'
import { Popover } from '~/components/_shared/Popover'
import { useLocalize } from '~/context/localize'

import styles from './InlineForm.module.scss'

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

  const handleFormInput = async (e: { currentTarget: HTMLInputElement; target: HTMLInputElement }) => {
    const value = (e.currentTarget || e.target).value
    setFormValueError()
    setFormValue(value)

    // Детектим платформу для embed формы
    if (props.supportPlainText && value.trim()) {
      try {
        const { detectEmbedPlatform } = await import('~/components/SimpleRichEditor/media/validation')
        const platform = detectEmbedPlatform(value.trim())
        if (platform !== 'unknown') {
          setDetectedPlatform(platform)
          setShowPlatformBadge(true)
        } else {
          setShowPlatformBadge(false)
        }
      } catch {
        setShowPlatformBadge(false)
      }
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
        {/* Platform badge с анимацией */}
        <Show when={showPlatformBadge()}>
          <div class={clsx(styles.platformBadge, { [styles.visible]: showPlatformBadge() })}>
            <Icon name={`social-${detectedPlatform()}`} />
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
    </div>
  )
}
