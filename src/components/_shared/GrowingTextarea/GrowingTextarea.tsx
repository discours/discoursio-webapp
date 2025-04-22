import { clsx } from 'clsx'
import { Show, createEffect, createSignal } from 'solid-js'
import { NoHydration } from 'solid-js/web'

import styles from './GrowingTextarea.module.scss'

type Props = {
  class?: string
  placeholder: string
  initialValue?: string
  onChange: (s: string) => void
  maxLength?: number
  allowEnterKey: boolean
  variant?: 'bordered'
  fieldName?: string
  textAreaRef?: (el: HTMLTextAreaElement) => void
  onClick?: (e: { currentTarget: HTMLTextAreaElement; target: Element; stopPropagation: () => void }) => void
}

export const GrowingTextarea = (props: Props) => {
  const [value, setValue] = createSignal<string>('')
  const [isFocused, setIsFocused] = createSignal(false)

  createEffect(() => {
    if (((props.maxLength && props.initialValue?.length) || 0) > (props.maxLength || 0)) {
      setValue(props.initialValue?.slice(0, props.maxLength || 0) || '')
    } else {
      setValue(props.initialValue ?? '')
    }
  })
  const handleChangeValue = (textareaValue: string) => {
    setValue(textareaValue)
    props.onChange(textareaValue)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && event.shiftKey) {
      return
    }

    if (event.key === 'Enter' && !event.shiftKey && value()?.trim().length > 0) {
      event.preventDefault()
    }
  }

  return (
    <NoHydration>
      <div
        class={clsx(styles.GrowingTextarea, {
          [styles.bordered]: props.variant === 'bordered',
          [styles.hasFieldName]: props.fieldName && value().length > 0
        })}
      >
        <Show when={props.fieldName && value().length > 0}>
          <div class={styles.fieldName}>{props.fieldName}</div>
        </Show>
        <div class={clsx(styles.growWrap, props.class)} data-replicated-value={value()}>
          <textarea
            ref={props.textAreaRef}
            rows={1}
            maxlength={props.maxLength}
            autocomplete="off"
            class={clsx(styles.textInput, props.class)}
            value={
              props.initialValue && props.maxLength
                ? props.initialValue?.slice(0, props.maxLength)
                : props.initialValue
            }
            onKeyDown={props.allowEnterKey ? handleKeyDown : () => 1}
            onInput={(event) => handleChangeValue(event.target.value)}
            placeholder={props.placeholder}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onClick={props.onClick}
          />
        </div>
        <Show when={(props.maxLength && value() && isFocused()) || props.variant === 'bordered'}>
          <div
            class={clsx(styles.maxLength, {
              [styles.visible]: isFocused(),
              [styles.limited]: value().length === props.maxLength
            })}
          >
            <Show when={props.variant === 'bordered'} fallback={`${value().length} / ${props.maxLength}`}>
              {`${(props.maxLength || 0) - value().length}`}
            </Show>
          </div>
        </Show>
      </div>
    </NoHydration>
  )
}

export default GrowingTextarea // for async load
