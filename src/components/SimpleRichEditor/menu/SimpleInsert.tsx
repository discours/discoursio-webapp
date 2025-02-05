import clsx from 'clsx'
import { Component, JSX, Show, createSignal } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'

import styles from './SimpleInsert.module.scss'

interface SimpleInsertProps {
  placeholder: string
  onSubmit: (value: string) => void
  validate?: (value: string) => string
  class?: string
  icon?: string
  autofocus?: boolean
  initialText?: string
}

export const SimpleInsert: Component<SimpleInsertProps> = (props) => {
  const [value, setValue] = createSignal(props.initialText || '')
  const [error, setError] = createSignal('')
  let inputRef: HTMLInputElement | undefined

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    const validationError = props.validate?.(value()) || ''

    if (validationError) {
      setError(validationError)
      return
    }

    props.onSubmit(value())
    setValue('')
    setError('')
  }

  const handleInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (e) => {
    setValue(e.currentTarget.value)
    if (error()) setError('')
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !error() && value().trim()) {
      handleSubmit(e)
    }
  }

  return (
    <form class={clsx(styles.form, props.class, { [styles.hasError]: !!error() })} onSubmit={handleSubmit}>
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
      <Show when={error()}>
        <div class={styles.error}>{error()}</div>
      </Show>
    </form>
  )
}
