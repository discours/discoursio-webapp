import clsx from 'clsx'
import { Component, createSignal } from 'solid-js'
import { Button } from '~/components/_shared/Button'
import { useLocalize } from '~/context/localize'
import styles from './SimpleInsertLinkForm.module.scss'

interface InsertLinkFormProps {
  class?: string
  onClose?: () => void
  onSubmit?: (url: string) => void
  onRemove?: () => void
  onClick?: (e: MouseEvent) => void
}

const HTTPS_REGEX = /^https?:\/\//
const URL_REGEX = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/[a-z0-9-._~:/?#[\]@!$&'()*+,;=]*)?$/i

export const SimpleInsertLinkForm: Component<InsertLinkFormProps> = (props) => {
  const { t } = useLocalize()
  const [url, setUrl] = createSignal('')
  const [error, setError] = createSignal('')

  const validateUrl = (str: string): string => {
    if (!str.trim()) {
      return t('URL cannot be empty')
    }

    try {
      // Упрощаем валидацию - проверяем только базовый формат
      if (!URL_REGEX.test(str)) {
        return t('Invalid URL')
      }
      return ''
    } catch {
      return t('Invalid URL')
    }
  }

  const normalizeUrl = (str: string): string => {
    const trimmed = str.trim()
    return trimmed.match(HTTPS_REGEX) ? trimmed : `https://${trimmed}`
  }

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()

    const trimmedUrl = url().trim()
    const validationError = validateUrl(trimmedUrl)

    if (validationError) {
      setError(validationError)
      return
    }

    // Нормализуем URL и вызываем onSubmit
    const normalizedUrl = normalizeUrl(trimmedUrl)
    props.onSubmit?.(normalizedUrl)

    // Очищаем форму и закрываем её
    setUrl('')
    setError('')
    props.onClose?.()
  }

  const handleCancel = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()

    props.onRemove?.()
    props.onClose?.()

    // Очищаем форму
    setUrl('')
    setError('')

    // Закрываем форму
    props.onClose?.()
  }

  const handleInput = (e: InputEvent) => {
    const input = e.target as HTMLInputElement
    setUrl(input.value)
    if (error()) {
      // Перевалидируем при изменении
      const validationError = validateUrl(input.value)
      setError(validationError)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      props.onClose?.()
    } else if (e.key === 'Enter' && !error() && url().trim()) {
      handleSubmit(e)
    }
  }

  return (
    <form
      class={clsx(styles.form, props.class)}
      onSubmit={handleSubmit}
      onClick={(e) => {
        e.stopPropagation()
        props.onClick?.(e)
      }}
    >
      <div class={styles.inputWrapper}>
        <input
          type="text"
          value={url()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={t('Enter URL')}
          class={clsx(styles.input, { [styles.error]: error() })}
          onClick={(e) => e.stopPropagation()}
          autocomplete="off"
          spellcheck={false}
          autofocus // Автофокус на инпут при открытии
        />
        {error() && <div class={styles.errorMessage}>{error()}</div>}
      </div>
      <div class={styles.buttons}>
        <Button
          type="button"
          value={t('Очистить')}
          variant="secondary"
          onClick={() => handleCancel(new Event('click'))}
        />
        <Button type="submit" value={t('Add')} variant="primary" disabled={!url().trim() || !!error()} />
      </div>
    </form>
  )
}
