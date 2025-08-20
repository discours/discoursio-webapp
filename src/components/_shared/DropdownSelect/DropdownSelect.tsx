import { clsx } from 'clsx'
import { createSignal, For, Show } from 'solid-js'

import { useOutsideClickHandler } from '~/lib/useOutsideClickHandler'

import styles from './DropdownSelect.module.scss'

type FilterItem = {
  title: string
  description?: string
}

type Props = {
  class?: string
  selectItems: FilterItem[]
}

export const DropdownSelect = (props: Props) => {
  const [selected, _setSelected] = createSignal<FilterItem>(props.selectItems[0])
  const [isDropDownVisible, setIsDropDownVisible] = createSignal(false)
  let containerRef: HTMLElement | null

  const handleShowDropdown = () => {
    setIsDropDownVisible(!isDropDownVisible())
  }

  useOutsideClickHandler({
    predicate: () => isDropDownVisible(),
    handler: () => setIsDropDownVisible(false)
  })

  return (
    <div class={clsx(styles.DropdownSelect, props.class)}>
      <div class={clsx(styles.toggler, { [styles.isOpen]: isDropDownVisible() })} onClick={handleShowDropdown}>
        <div>{selected().title}</div>
      </div>

      <Show when={isDropDownVisible()}>
        <ul class={styles.listItems} ref={(el) => (containerRef = el)}>
          <For each={props.selectItems}>
            {(item) => (
              <li>
                <h3 class={styles.title}>{item.title}</h3>
                <Show when={item.description}>
                  <p class={styles.description}>{item.description}</p>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}
