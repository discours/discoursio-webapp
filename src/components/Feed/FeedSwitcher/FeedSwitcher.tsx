import { A, useLocation, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createMemo } from 'solid-js'
import { orderByMode, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { FeedMode } from '~/types/nav'
import { capitalize } from '~/utils/capitalize'
import styles from './FeedSwitcher.module.scss'

type ViewOption = string | { value: string; title: string }

interface Props {
  class?: string
  options: ViewOption[]
  prefix: string
  onMouseOver?: (option: string) => void
  onMouseOut?: (event?: MouseEvent) => void
  counters?: Record<string, number>
  isLoading?: boolean
}

const PERFIX_REGEX = /^\//

export const FeedSwitcher = (props: Props) => {
  const loc = useLocation()
  const { t } = useLocalize()
  const navigate = useNavigate()
  const { updateOptions } = useFeed()

  const currentOption = createMemo(() => {
    const path = loc.pathname.replace(props.prefix, '').replace(PERFIX_REGEX, '')
    return path || 'recent'
  })

  const getOptionValue = (option: ViewOption) => (typeof option === 'string' ? option : option.value)

  const getOptionTitle = (option: ViewOption) =>
    typeof option === 'string' ? t(capitalize(option)) : option.title

  const getPath = createMemo(
    () => (value: string, idx: () => number) =>
      props.prefix ? (idx() ? `${props.prefix}/${value}` : props.prefix) : idx() ? `/${value}` : '/'
  )

  const handleClick = (ev: MouseEvent, option: ViewOption, idx: () => number) => {
    ev?.preventDefault()
    const value = getOptionValue(option)

    updateOptions({
      offset: 0,
      order_by: orderByMode(value as FeedMode)
    })

    navigate(getPath()(value, idx))
  }

  return (
    <ul class={clsx(styles.feedSwitcher, styles.feedFilter, props.class)}>
      <For each={props.options}>
        {(option, idx) => {
          const value = createMemo(() => getOptionValue(option))
          const isSelected = createMemo(() => value() === currentOption())
          const title = createMemo(() => getOptionTitle(option))
          const path = createMemo(() => getPath()(value(), idx))
          const counter = createMemo(() => props.counters?.[value()])

          return (
            <li
              class={clsx({ [styles.itemSelected]: isSelected() })}
              onMouseOver={() => !isSelected() && props.onMouseOver?.(value())}
              onMouseOut={() => !isSelected() && props.onMouseOut?.()}
            >
              <Show
                when={!(isSelected() && props.isLoading)}
                fallback={<span class={styles.active}>{title()}</span>}
              >
                <A href={path()} onClick={(ev) => handleClick(ev, option, idx)}>
                  {title()}
                  <Show when={counter() !== undefined}>
                    <span class={styles.itemCounter}>{counter()}</span>
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
