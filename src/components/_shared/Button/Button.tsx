import { clsx } from 'clsx'
import type { JSX } from 'solid-js'

import styles from './Button.module.scss'

export type ButtonVariant = 'primary' | 'secondary' | 'bordered' | 'inline' | 'light' | 'outline' | 'danger'
type Props = {
  title?: string
  value: string | JSX.Element
  size?: 'S' | 'M' | 'L'
  variant?: ButtonVariant
  type?: 'submit' | 'button'
  loading?: boolean
  disabled?: boolean
  onClick?: (event?: MouseEvent) => void
  class?: string
  ref?: HTMLButtonElement | ((el: HTMLButtonElement) => void)
  isSubscribeButton?: boolean
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-expanded'?: boolean
  'aria-pressed'?: boolean
}

export const Button = (props: Props) => {
  return (
    <button
      ref={(el) => {
        if (typeof props.ref === 'function') {
          props.ref(el)
          return
        }
        props.ref = el
      }}
      title={props.title || (typeof props.value === 'string' ? props.value : '')}
      onClick={props.onClick}
      type={props.type ?? 'button'}
      disabled={props.loading || props.disabled}
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
      aria-expanded={props['aria-expanded']}
      aria-pressed={props['aria-pressed']}
      aria-busy={props.loading}
      class={clsx(
        styles.button,
        styles[props.size ?? 'M'],
        styles[props.variant ?? 'primary'],
        {
          [styles.loading]: props.loading,
          [styles.subscribeButton]: props.isSubscribeButton
        },
        props.class
      )}
    >
      {props.value}
    </button>
  )
}
