import clsx from 'clsx'
import { Component, createSignal } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'

import styles from './SimpleInsert.module.scss'

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
  const [value, setValue] = createSignal(props.initialText || '')
  const [error, setError] = createSignal('')
  let inputRef: HTMLInputElement | undefined

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
  }

  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement
    setValue(target.value)
    setError('')
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setValue('')
      setError('')
      inputRef?.blur()
    }
  }

  return (
    <form onSubmit={handleSubmit} class={clsx(styles.form, props.class, { [styles.hasError]: error() })}>
      <div class={styles.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          value={value()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder}
          class={styles.input}
          autocomplete="off"
          spellcheck={false}
          autofocus={props.autofocus}
        />
        <button type="submit" class={styles.submitButton} disabled={!value().trim() || !!error()}>
          <Icon name={props.icon || 'arrow-right'} />
        </button>
      </div>
      {error() && <div class={styles.error}>{error()}</div>}
    </form>
  )
}

interface SimpleInsertProps {
  /** Placeholder text for input */
  placeholder: string
  /** Called when form submitted with validated value */
  onSubmit: (value: string) => void
  /** Optional validation function, returns error message or empty string */
  validate?: (value: string) => string
  /** Additional CSS class */
  class?: string
  /** Icon name for submit button */
  icon?: string
  /** Whether to focus input on mount */
  autofocus?: boolean
  /** Initial input value */
  initialText?: string
}
