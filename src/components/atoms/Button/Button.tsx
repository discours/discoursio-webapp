import { clsx } from 'clsx'
import { createSignal, JSX } from 'solid-js'

import styles from './Button.module.scss'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'primary-square'
  | 'secondary-square'
  | 'subscribeButton'
  | 'unsubscribeButton'
type Props = {
  title?: string
  value: string | JSX.Element
  size?: 'S' | 'M' | 'L' | 'M-square' | 'S-square' | 'XS-square'
  variant?: ButtonVariant
  type?: 'submit' | 'button'
  loading?: boolean
  disabled?: boolean
  onClick?: (event?: MouseEvent) => void
  class?: string
  ref?: HTMLButtonElement | ((el: HTMLButtonElement) => void)
  isSubscribeButton?: boolean
}

export const Button = (props: Props) => {
  const [loading, setLoading] = createSignal(Boolean(props.loading))

  const handleClick = (event: MouseEvent) => {
    if (loading() || props.loading) return
    setLoading(true)

    props.onClick?.(event)

    setLoading(false)
  }

  const LoadingDots = () => {
    return (
      <div class={styles.loadingDots}>
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </div>
    )
  }

  const isLoading = loading()

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
      onClick={handleClick}
      type={props.type ?? 'button'}
      disabled={isLoading || props.disabled}
      class={clsx(
        styles.button,
        {
          [styles['M']]: Boolean(props.size === 'M'),
          [styles['primary']]: Boolean(props.variant === 'primary'),
          [styles['loadingDots']]: isLoading,
          [styles.subscribeButton]: props.isSubscribeButton,

          'button--primary': props.variant === 'primary',
          'button--secondary': props.variant === 'secondary',
          'button--square-primary': props.variant === 'primary-square',
          'button--square-secondary': props.variant === 'secondary-square'
        },
        props.class
      )}
    >
      {isLoading ? <LoadingDots /> : props.value}
      {/*{props.value}*/}
    </button>
  )
}
