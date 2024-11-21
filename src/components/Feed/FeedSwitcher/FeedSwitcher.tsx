import { A, useLocation, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createEffect, createMemo } from 'solid-js'
import { orderByMode, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { capitalize } from '~/utils/capitalize'

import styles from './FeedSwitcher.module.scss'

type ViewOption = string | { value: string; title: string }

type FeedSwitcherProps = {
  class?: string
  options: ViewOption[]
  prefix: string
  onMouseOver?: (option: string) => void
  onMouseOut?: (event?: MouseEvent) => void
  counters?: Record<string, number>
  isLoading?: boolean
}

const getOptionValue = (option: ViewOption) => (typeof option === 'string' ? option : option.value)
const FIRST_SLASH_REGEX = /^\//

export const FeedSwitcher = (props: FeedSwitcherProps) => {
  const loc = useLocation()
  const { t } = useLocalize()
  const navigate = useNavigate()
  const { updateOptions, mode: feedMode } = useFeed()

  console.log('[FeedSwitcher] Initial render with props:', {
    options: props.options,
    prefix: props.prefix,
    pathname: loc.pathname
  })

  // Мемоизируем текущую опцию на основе URL
  const currentOption = createMemo(() => {
    const path = loc.pathname.replace(props.prefix, '').replace(FIRST_SLASH_REGEX, '')
    const option = path || 'recent'
    console.log('[FeedSwitcher] currentOption memo:', {
      pathname: loc.pathname,
      path,
      option,
      feedMode: feedMode()
    })
    return option
  })

  // Отслеживаем изменения URL и режима
  createEffect(() => {
    const option = currentOption()
    const mode = feedMode()
    console.log('[FeedSwitcher] Effect triggered:', {
      currentOption: option,
      feedMode: mode,
      pathname: loc.pathname
    })
  })

  const handleClick = (ev: MouseEvent, option: ViewOption, idx: () => number) => {
    ev?.preventDefault()
    const value = getOptionValue(option)
    console.log('[FeedSwitcher] handleClick:', {
      value,
      currentOption: currentOption(),
      idx: idx()
    })

    const path = props.prefix
      ? idx()
        ? `${props.prefix}/${value}`
        : props.prefix
      : idx()
        ? `/${value}`
        : '/'

    console.log('[FeedSwitcher] Updating options and navigating:', {
      path,
      orderBy: orderByMode(value),
      value
    })

    // Обновляем опции перед навигацией
    updateOptions({
      offset: 0,
      order_by: orderByMode(value)
    })

    navigate(path)
  }

  return (
    <ul class={clsx(styles.feedSwitcher, styles.feedFilter, props.class)}>
      <For each={props.options}>
        {(option: ViewOption, idx) => {
          // Мемоизируем состояние выбранности для каждой опции
          const isSelected = createMemo(() => {
            const optionValue = getOptionValue(option)
            const selected = optionValue === currentOption()
            console.log('[FeedSwitcher] Option selection check:', {
              optionValue,
              currentOption: currentOption(),
              selected
            })
            return selected
          })

          return (
            <li
              class={clsx({ [styles.itemSelected]: isSelected() })}
              onMouseOver={() => {
                console.log('[FeedSwitcher] Mouse over:', getOptionValue(option))
                !isSelected() && props.onMouseOver?.(getOptionValue(option))
              }}
              onMouseOut={() => {
                console.log('[FeedSwitcher] Mouse out:', getOptionValue(option))
                !isSelected() && props.onMouseOut?.()
              }}
            >
              <Show
                when={!(isSelected() && props.isLoading)}
                fallback={
                  <span class={styles.active}>
                    {typeof option === 'string' ? t(capitalize(option)) : option.title}
                    <Show when={props.counters?.[getOptionValue(option)] !== undefined}>
                      <span class={styles.itemCounter}>{props.counters?.[getOptionValue(option)]}</span>
                    </Show>
                  </span>
                }
              >
                <A
                  href={
                    props.prefix
                      ? idx()
                        ? `${props.prefix}/${getOptionValue(option)}`
                        : props.prefix
                      : idx()
                        ? `/${getOptionValue(option)}`
                        : '/'
                  }
                  onClick={(ev) => handleClick(ev, option, idx)}
                >
                  {typeof option === 'string' ? t(capitalize(option)) : option.title}
                  <Show when={props.counters?.[getOptionValue(option)] !== undefined}>
                    <span class={styles.itemCounter}>{props.counters?.[getOptionValue(option)]}</span>
                  </Show>
                </A>
              </Show>
            </li>
          )
        }}
      </For>
    </ul>
  )
}
