import { clsx } from 'clsx'
import { createMemo, createSignal, For, JSX, Show } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import type { PopupProps } from '../Popup'
import { Popup } from '../Popup'

import popupStyles from '../Popup/Popup.module.scss'
import styles from './DropDown.module.scss'

export type Option = {
  value?: string | number
  title: string
  selected?: boolean
  icon?: string
}

export type OptionGroup = {
  title?: string
  options: Option[]
  selected?: number[]
  onChange?: (option: Option) => void
  multiple?: boolean
}

type DropDownProps = {
  class?: string
  popupProps?: Partial<PopupProps>
  options: OptionGroup[] | Option[]
  triggerCssClass?: string
  triggerContent?: JSX.Element
  onChange?: (option: Option) => void
}

const Chevron = (props: { class?: string }) => {
  return (
    <svg class={props.class} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M4.5 6.75L9 11.25L13.5 6.75"
        stroke="#141414"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}

const CheckMark = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="check-mark"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const OptionItem = (props: {
  option: Option
  isActive: boolean
  onClick: (option: Option) => void
  multiple?: boolean
}) => (
  <li>
    <button
      class={clsx(popupStyles.action, {
        [styles.active]: props.isActive
      })}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        props.onClick(props.option)
      }}
    >
      <Show when={props.option.icon}>
        <Icon name={props.option.icon as string} class={clsx(styles.optionIcon, props.isActive && styles.active)} />
      </Show>
      <Show when={props.option.title}>
        <span>{props.option.title}</span>
        <Show when={props.isActive}>
          <CheckMark />
        </Show>
      </Show>
    </button>
  </li>
)

const GroupOptions = (props: { group: OptionGroup; showTitle: boolean; index: number }) => (
  <div>
    <Show when={props.showTitle}>
      {props.index !== 0 && (
        <li class={styles.separator}>
          <hr />
        </li>
      )}
      <Show when={props.group.title}>
        <li class={styles.groupTitle}>
          <span id={`group-${props.index}`}>{props.group.title}</span>
        </li>
      </Show>
    </Show>
    <For each={props.group.options}>
      {(option, index) => (
        <OptionItem
          option={option}
          isActive={props.group.selected?.includes(index()) || false}
          onClick={
            props.group.onChange ||
            (() => {
              console.log('TODO: implement onClick')
            })
          }
          multiple={props.group.multiple}
        />
      )}
    </For>
  </div>
)

export const DropDown = (props: DropDownProps) => {
  const [isPopupVisible, setIsPopupVisible] = createSignal(false)

  const isOptionGroup = createMemo(
    () => Array.isArray(props.options) && props.options.length > 0 && 'options' in props.options[0]
  )

  const getDisplayTitle = () => {
    if (isOptionGroup()) {
      const groups = props.options as OptionGroup[]
      const firstGroup = groups[0]

      if (!firstGroup?.options?.length) {
        return ''
      }

      const selectedIndex = firstGroup.selected?.[0]
      return selectedIndex !== undefined && firstGroup.options[selectedIndex]
        ? firstGroup.options[selectedIndex].title
        : firstGroup.options[0].title
    }

    const options = props.options as Option[]
    if (!options?.length) {
      return ''
    }

    const activeOption = options.find((opt) => opt.selected)
    return activeOption?.title || options[0]?.title || ''
  }

  const renderContent = () => {
    if (isOptionGroup()) {
      const groups = props.options as OptionGroup[]
      const showGroupTitles = groups.length > 1
      return (
        <For each={groups.filter((group) => group?.options.length > 0)}>
          {(group, index) => <GroupOptions group={group} showTitle={showGroupTitles} index={index()} />}
        </For>
      )
    }

    return (
      <For each={props.options as Option[]}>
        {(option) => <OptionItem option={option} isActive={false} onClick={(opt) => props.onChange?.(opt)} />}
      </For>
    )
  }

  const isMultipleSelect = createMemo(() => {
    if (isOptionGroup()) {
      const groups = props.options as OptionGroup[]
      return groups.some((group) => group.multiple)
    }
    return false
  })

  const renderTrigger = () => {
    if (props.triggerContent) {
      return props.triggerContent
    }

    return (
      <button
        class={clsx(styles.trigger, props.triggerCssClass, styles.nonSelectable)}
        aria-expanded={isPopupVisible()}
        aria-haspopup="listbox"
        aria-label="Выберите опцию"
      >
        {getDisplayTitle()}{' '}
        <Chevron
          class={clsx(styles.chevron, {
            [styles.rotate]: isPopupVisible()
          })}
          aria-hidden="true"
        />
      </button>
    )
  }

  return (
    <Show when={props.options.length > 0} keyed={true}>
      <Popup
        trigger={renderTrigger()}
        variant="tiny"
        onVisibilityChange={setIsPopupVisible}
        keepOpen={isMultipleSelect()}
        {...props.popupProps}
      >
        <ul class="nodash">{renderContent()}</ul>
      </Popup>
    </Show>
  )
}
