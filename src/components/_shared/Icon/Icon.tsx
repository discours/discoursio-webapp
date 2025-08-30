import { clsx } from 'clsx'
import type { JSX } from 'solid-js'
import { mergeProps, Show } from 'solid-js'
import { NoHydration } from 'solid-js/web'

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

  const iconSrc = () => `/icons/${props.name || 'default'}.svg`

  return (
    <NoHydration>
      <div class={clsx('icon', styles.icon, props.class)} style={props.style} data-icon={props['data-icon']}>
        <img
          alt={props.title || props.name}
          class={clsx(props.iconClassName)}
          src={iconSrc()}
          onError={(e) => {
            // ✅ Предотвращаем бесконечный цикл в офлайне
            const currentSrc = e.currentTarget.src
            const isAlreadyDefault = currentSrc.includes('/icons/default.svg')
            const hasTriedFallback = e.currentTarget.dataset.fallbackAttempted === 'true'

            if (!isAlreadyDefault && !hasTriedFallback) {
              // Первая попытка - пробуем default.svg
              e.currentTarget.dataset.fallbackAttempted = 'true'
              e.currentTarget.src = '/icons/default.svg'
            } else {
              // Вторая попытка или уже default.svg - скрываем иконку
              console.warn(`Failed to load icon: ${props.name} (offline or missing file)`)
              e.currentTarget.style.display = 'none'
              // Удаляем обработчик чтобы избежать повторных вызовов
              e.currentTarget.onerror = null
            }
          }}
        />

        <Show when={props.counter > 0}>
          <div class={styles.notificationsCounter}>{props.counter}</div>
        </Show>
      </div>
    </NoHydration>
  )
}
