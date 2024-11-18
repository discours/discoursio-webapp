import { A, useLocation, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createEffect, createMemo, on } from 'solid-js'
import { orderByMode, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { capitalize } from '~/utils/capitalize'

import styles from './FeedSwitcher.module.scss'

type ViewOption = string | { value: string; title: string }

type ViewSwitcherProps = {
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
export const ViewSwitcher = (props: ViewSwitcherProps) => {
  const loc = useLocation()
  const { t } = useLocalize()
  const navigate = useNavigate()
  const { updateOptions } = useFeed()

  const activeOption = createMemo(() => {
    const currentPath = loc.pathname.replace(props.prefix, '').replace(FIRST_SLASH_REGEX, '')
    return currentPath || 'recent'
  })

  createEffect(
    on(activeOption, (mode) => {
      updateOptions({
        order_by: orderByMode(mode),
        offset: 0
      })
    })
  )

  const handleClick = (ev: MouseEvent, option: ViewOption, idx: () => number) => {
    ev?.preventDefault()

    const path = props.prefix
      ? idx()
        ? `${props.prefix}/${getOptionValue(option)}`
        : props.prefix
      : idx()
        ? `/${getOptionValue(option)}`
        : '/'

    if (path === loc.pathname) {
      const mode = getOptionValue(option) || 'recent'
      updateOptions({
        order_by: orderByMode(mode),
        offset: 0
      })
    } else {
      navigate(path)
    }
  }

  return (
    <ul class={clsx(styles.viewSwitcher, styles.feedFilter, props.class)}>
      <For each={props.options}>
        {(option: ViewOption, idx) => {
          const isSelected = createMemo(() => {
            const optionValue = getOptionValue(option)
            return optionValue ? activeOption() === optionValue : activeOption() === 'recent'
          })

          return (
            <li
              class={clsx({ [styles.itemSelected]: isSelected() })}
              onMouseOver={() => !isSelected() && props.onMouseOver?.(getOptionValue(option))}
              onMouseOut={() => !isSelected() && props.onMouseOut?.()}
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
