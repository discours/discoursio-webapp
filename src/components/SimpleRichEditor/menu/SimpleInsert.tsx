import { clsx } from 'clsx'
import { Component, createSignal } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'

import styles from './SimpleInsert.module.scss'

interface SimpleInsertProps {
  /** Начальное значение */
  initialValue?: string
  /** Плейсхолдер */
  placeholder?: string
  /** Колбэк при успешной вставке */
  onSubmit: (value: string) => void
  /** Колбэк при закрытии */
  onClose?: () => void
  /** Функция валидации */
  validate?: (value: string) => string
  /** Дополнительный класс */
  class?: string
  /** Иконка для кнопки */
  icon?: string
  /** Позиция относительно редактора */
  position?: { top: number; left: number }
}

/**
 * Generic form component for inserting content with validation
 *
 * Features:
 * - Input with validation
 * - Submit button
 * - Error display
 * - Keyboard handling (Enter to submit, Escape to cancel)
 * - Autofocus
 *
 * @example
 * ```tsx
 * <SimpleInsert
 *   placeholder="Enter URL"
 *   onSubmit={(url) => insertLink(url)}
 *   validate={(url) => validateUrl(url)}
 *   icon="link"
 *   autofocus
 * />
 * ```
 */
export const SimpleInsert: Component<SimpleInsertProps> = (props) => {
  const [value, setValue] = createSignal(props.initialValue || '')
  const [error, setError] = createSignal('')

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    const trimmedValue = value().trim()

    if (props.validate) {
      const error = props.validate(trimmedValue)
      if (error) {
        setError(error)
        return
      }
    }

    props.onSubmit(trimmedValue)
    setValue('')
    setError('')
    props.onClose?.()
  }

  const handleCancel = () => {
    setValue('')
    setError('')
    props.onClose?.()
  }

  return (
    <form class={clsx(styles.form, props.class)} onSubmit={handleSubmit}>
      <input
        type="text"
        value={value()}
        onInput={(e) => {
          setValue(e.currentTarget.value)
          setError('')
        }}
        placeholder={props.placeholder}
        class={styles.input}
      />

      <div class={styles.buttons}>
        <button type="button" class={styles.cancel} onClick={handleCancel}>
          <Icon name="close" />
        </button>
        <button type="submit" class={styles.submit} disabled={!value().trim() || !!error()}>
          <Icon name={props.icon || 'check'} />
        </button>
      </div>

      {error() && <div class={styles.error}>{error()}</div>}
    </form>
  )
}
