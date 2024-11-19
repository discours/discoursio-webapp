import { A, useLocation, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
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
  const { updateOptions } = useFeed()
  const [currentOption, setCurrentOption] = createSignal('recent')

  createEffect(() => {
    const currentPath = loc.pathname.replace(props.prefix, '').replace(FIRST_SLASH_REGEX, '')
    setCurrentOption(currentPath || 'recent')
  })

  const handleClick = (ev: MouseEvent, option: ViewOption, idx: () => number) => {
    ev?.preventDefault()
    const value = getOptionValue(option)
    const path = props.prefix
      ? idx()
        ? `${props.prefix}/${value}`
        : props.prefix
      : idx()
        ? `/${value}`
        : '/'

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
          const isSelected = createMemo(() => {
            const optionValue = getOptionValue(option)
            return optionValue ? currentOption() === optionValue : currentOption() === 'recent'
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
