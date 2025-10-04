import { clsx } from 'clsx'
import type { JSX } from 'solid-js'
import { createSignal, mergeProps, Show } from 'solid-js'

import styles from './Icon.module.scss'

type IconProps = {
  class?: string
  iconClassName?: string
  style?: string | JSX.CSSProperties
  title?: string
  name?: string
  counter?: number
  'data-icon'?: string

  /** Суффикс для hover-варианта иконки (например, 'colored', 'hover') */
  hoverSuffix?: string
  /** Суффикс для активного состояния (например, 'checked') */
  activeSuffix?: string
  /** Активно ли состояние (для activeSuffix) */
  isActive?: boolean
}

export const Icon = (passedProps: IconProps) => {
  const props = mergeProps({ title: '', name: '', counter: 0, isActive: false }, passedProps)
  const [isLoaded, setIsLoaded] = createSignal(false)
  const [isHovered, setIsHovered] = createSignal(false)

  const iconSrc = () => {
    const baseName = props.name || 'default'

    // Если активно и есть activeSuffix
    if (props.isActive && props.activeSuffix) {
      return `/icons/${baseName}-${props.activeSuffix}.svg`
    }

    // Если hover и есть hoverSuffix
    if (isHovered() && props.hoverSuffix) {
      return `/icons/${baseName}-${props.hoverSuffix}.svg`
    }

    return `/icons/${baseName}.svg`
  }

  return (
    <div
      class={clsx('icon', styles.icon, props.class)}
      style={props.style}
      data-icon={props['data-icon']}
      onMouseEnter={() => props.hoverSuffix && setIsHovered(true)}
      onMouseLeave={() => props.hoverSuffix && setIsHovered(false)}
    >
      <img
        alt={props.title || props.name}
        class={clsx(props.iconClassName, {
          loaded: isLoaded()
        })}
        src={iconSrc()}
        onLoad={() => setIsLoaded(true)}
        onError={(e) => {
          // ✅ Предотвращаем бесконечный цикл в офлайне
          const currentSrc = e.currentTarget.src
          const isAlreadyDefault = currentSrc.includes('/icons/default.svg')
          const hasTriedFallback = e.currentTarget.dataset.fallbackAttempted === 'true'

          if (!isAlreadyDefault && !hasTriedFallback) {
            // Первая попытка - пробуем default.svg
            e.currentTarget.dataset.fallbackAttempted = 'true'
            setIsLoaded(false) // ✨ Сбрасываем состояние для плавного fallback
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
  )
}
