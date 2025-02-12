import { clsx } from 'clsx'
import { Component, For } from 'solid-js'
import { DropDown, Option, OptionGroup } from '~/components/_shared/DropDown/DropDown'
import { Icon } from '~/components/_shared/Icon'
import { Popover } from '~/components/_shared/Popover'
import { useLocalize } from '~/context/localize'
import { capitalize } from '~/utils/capitalize'
import { CommandGroupType, CommandType, MENU_GROUPS, isGroup } from '../lib/commands'

import { Position } from '../lib/types'
import styles from './SimpleToolbar.module.scss'

export const ToolbarControl: Component<{
  action: CommandType | CommandGroupType
  onAction: (action: CommandType | CommandGroupType) => void
  currentFormats: Set<CommandType>
  isVisible?: boolean
  onClose?: () => void
  class?: string
}> = (props) => {
  const { t } = useLocalize()

  if (!isGroup(props.action)) {
    return (
      <Popover content={t(props.action)}>
        {(ref) => (
          <button
            ref={ref}
            onClick={() => props.onAction(props.action as CommandType)}
            class={clsx(styles.button, props.class, {
              [styles.active]: props.currentFormats.has(props.action as CommandType)
            })}
          >
            <Icon name={`editor-${props.action}`} />
          </button>
        )}
      </Popover>
    )
  }

  const options: OptionGroup[] = [
    {
      title: t(capitalize(props.action)),
      options: MENU_GROUPS[props.action as CommandGroupType].map((item) => ({
        value: item,
        title: t(capitalize(item)),
        selected: props.currentFormats.has(item)
      })),
      selected: MENU_GROUPS[props.action as CommandGroupType]
        .map((_, i) => i)
        .filter((i) => props.currentFormats.has(MENU_GROUPS[props.action as CommandGroupType][i])),
      onChange: (option: Option) => {
        props.onAction(option.value as CommandType)
      }
    }
  ]

  return <DropDown options={options} triggerCssClass={styles.dropdownTrigger} class={styles.dropdown} />
}

/**
 * Основная панель инструментов редактора
 *
 * Особенности:
 * - Группировка команд
 * - Поддержка всех типов вставки
 * - Интеграция с SimpleInsert формами
 * - Отображение активных форматов
 * - Позиционирование по умолчанию внизу слева
 */
export interface SimpleToolbarProps {
  position?: Position
  class?: string
  commands: (CommandType | CommandGroupType)[]
  onAction: (action: CommandType | CommandGroupType) => void
  currentFormats: Set<CommandType>
  isVisible?: boolean
  onClose?: () => void
}

export const SimpleToolbar: Component<SimpleToolbarProps> = (props) => {
  return (
    <div
      class={clsx(styles.toolbar, props.class, { [styles.visible]: props.isVisible })}
      style={{
        top: `${props.position?.top || 'auto'}px`,
        left: `${props.position?.left || 'auto'}px`,
        bottom: `${props.position?.bottom || 'auto'}px`,
        right: `${props.position?.right || 'auto'}px`
      }}
    >
      <For each={props.commands}>
        {(action) => (
          <ToolbarControl
            action={action}
            onAction={props.onAction}
            currentFormats={props.currentFormats}
            isVisible={props.isVisible}
            onClose={props.onClose}
          />
        )}
      </For>
    </div>
  )
}
