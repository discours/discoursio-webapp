import { A, useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { capitalize } from '~/utils/capitalize'

import styles from './ViewSwitcher.module.scss'

type ViewOption = string | { value: string; title: string }

type ViewSwitcherProps = {
  class?: string
  active?: string
  options: ViewOption[]
  prefix: string
  onMouseOver?: (option: string) => void
  onMouseOut?: (event?: MouseEvent) => void
  counters?: Record<string, number>
  onClick?: (option: string) => void
}

export const ViewSwitcher = (props: ViewSwitcherProps) => {
  const loc = useLocation()
  const { t } = useLocalize()

  const getOptionValue = (option: ViewOption) => (typeof option === 'string' ? option : option.value)

  const getOptionTitle = (option: ViewOption) =>
    typeof option === 'string' ? t(capitalize(option)) : option.title

  return (
    <ul class={clsx(styles.viewSwitcher, styles.feedFilter, props.class)}>
      <For each={props.options}>
        {(option, idx) => {
          const value = getOptionValue(option)
          return (
            <li
              class={clsx({
                [styles.itemSelected]: loc.pathname === `${props.prefix}/${idx() ? value : ''}`
              })}
              onMouseOver={() => props.onMouseOver?.(value)}
              onMouseOut={props.onMouseOut}
            >
              <A href={`${props.prefix}/${idx() ? value : ''}`} onClick={() => props.onClick?.(value)}>
                {getOptionTitle(option)}
                <Show when={props.counters?.[value] !== undefined}>
                  <span class={styles.itemCounter}>{props.counters?.[value]}</span>
                </Show>
              </A>
            </li>
          )
        }}
      </For>
    </ul>
  )
}
