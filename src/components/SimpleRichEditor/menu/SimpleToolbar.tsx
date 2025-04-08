import { clsx } from 'clsx'
import { Component, For, Show } from 'solid-js'
import { DropDown, Option, OptionGroup } from '~/components/_shared/DropDown/DropDown'
import { Icon } from '~/components/_shared/Icon'
import { Popover } from '~/components/_shared/Popover'
import { useLocalize } from '~/context/localize'
import { capitalize } from '~/utils/capitalize'
import { CommandGroupType, CommandType, MENU_GROUPS, isGroup } from '../lib/commands'
import { Position } from '../lib/types'
import styles from './SimpleToolbar.module.scss'

export type EditorCommandId = keyof typeof MENU_GROUPS
export type EditorCommandGroup = EditorCommandId[]
export type EditorCommands = EditorCommandId[] | EditorCommandGroup[]
export type ToolbarMode = 'top' | 'bottom' | 'float' | 'hidden'
export type MenuGroupId = keyof typeof MENU_GROUPS
export type MenuItemType = 'button' | 'dropdown'
export type MenuGroup = {
  id: MenuGroupId
  type: MenuItemType
  icon?: string // для dropdown кнопок
  commands?: EditorCommandId[][]
}

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
            data-active={props.currentFormats.has(props.action as CommandType) ? 'true' : undefined}
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
 * - Интеграция с InlineForm формами
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
  editorId?: string
}

export const SimpleToolbar: Component<SimpleToolbarProps> = (props) => {
  const handleAction = (action: CommandType | CommandGroupType, e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation() // Предотвращаем всплытие
    console.log('Toolbar action clicked:', action)
    props.onAction(action)
  }

  return (
    <div
      class={clsx(styles.toolbar, props.class, {
        [styles.visible]: props.isVisible
      })}
      style={props.position ? `top: ${props.position.top}px; left: ${props.position.left}px` : undefined}
      onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие при клике на тулбар
      data-editor-id={props.editorId}
    >
      <For each={props.commands}>
        {(command) => (
          <Show
            when={!isGroup(command)}
            fallback={
              <div class={styles.group}>
                <For each={MENU_GROUPS[command as CommandGroupType]}>
                  {(groupCommand) => (
                    <button
                      class={clsx(styles.button, {
                        [styles.active]: props.currentFormats.has(groupCommand as CommandType)
                      })}
                      data-active={
                        props.currentFormats.has(groupCommand as CommandType) ? 'true' : undefined
                      }
                      onClick={(e) => handleAction(groupCommand, e)}
                      type="button"
                    >
                      <Icon name={`editor-${groupCommand}`} />
                    </button>
                  )}
                </For>
              </div>
            }
          >
            <button
              class={clsx(styles.button, {
                [styles.active]: props.currentFormats.has(command as CommandType)
              })}
              data-active={props.currentFormats.has(command as CommandType) ? 'true' : undefined}
              onClick={(e) => handleAction(command, e)}
              type="button"
            >
              <Icon name={`editor-${command === 'blockquote' ? 'quote' : command}`} />
            </button>
          </Show>
        )}
      </For>
    </div>
  )
}
