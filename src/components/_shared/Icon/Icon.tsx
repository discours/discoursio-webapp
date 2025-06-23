import { clsx } from 'clsx'
import type { JSX } from 'solid-js'
import { createMemo, mergeProps, Show } from 'solid-js'

import styles from './Icon.module.scss'

type IconProps = {
  class?: string
  iconClassName?: string
  style?: string | JSX.CSSProperties
  title?: string
  name?: string
  counter?: number
  'data-icon'?: string
}

export const Icon = (passedProps: IconProps) => {
  const props = mergeProps({ title: '', name: '', counter: 0 }, passedProps)

  const iconSrc = createMemo(() => {
    const iconName = props.name || 'default'
    return `/icons/${iconName}.svg`
  })

  return (
    <div class={clsx('icon', styles.icon, props.class)} style={props.style} data-icon={props['data-icon']}>
      <img
        alt={props.title || props.name}
        class={clsx(props.iconClassName)}
        src={iconSrc()}
        onError={(e) => {
          if (e.currentTarget.src !== '/icons/default.svg') {
            e.currentTarget.src = '/icons/default.svg'
          } else {
            console.warn(`Failed to load icon: ${props.name}`)
            e.currentTarget.style.display = 'none'
          }
        }}
      />

      <Show when={props.counter > 0}>
        <div class={styles.notificationsCounter}>{props.counter}</div>
      </Show>
    </div>
  )
}
