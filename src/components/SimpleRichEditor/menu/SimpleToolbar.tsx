import { clsx } from 'clsx'
import { Component, For } from 'solid-js'
import { DropDown, Option, OptionGroup } from '~/components/_shared/DropDown/DropDown'
import { Icon } from '~/components/_shared/Icon'
import { Popover } from '~/components/_shared/Popover'
import { useLocalize } from '~/context/localize'
import { capitalize } from '~/utils/capitalize'
import { MENU_GROUPS, isGroup } from '../lib/commands'
import { CommandGroupType, CommandType } from '../lib/types'
import { Position } from '../lib/types'
import styles from './SimpleToolbar.module.scss'

export type EditorCommandId = keyof typeof MENU_GROUPS
export type EditorCommandGroup = EditorCommandId[]
export type EditorCommands = EditorCommandId[] | EditorCommandGroup[]
export type ToolbarMode = 'top' | 'bottom' | 'float'
export type MenuGroupId = keyof typeof MENU_GROUPS
export type MenuItemType = 'button' | 'dropdown'
export type MenuGroup = {
  id: MenuGroupId
  type: MenuItemType
  icon?: string // для dropdown кнопок
  commands?: readonly (CommandType | readonly CommandType[])[]
}

/**
 * Определяет иконку для выпадающего меню на основе первой группы команд
 *
 * @param commands Массив команд в группе
 * @returns Название иконки для отображения
 */
const getDropdownIconName = (commands: readonly CommandType[]): string => {
  // Если команд нет, используем общую иконку
  if (!commands.length) return 'editor-more'

  // Проверяем первую команду/группу для определения типа меню
  const firstCommand = commands[0]

  // Если это массив с командами заголовков
  if (
    Array.isArray(firstCommand) &&
    (firstCommand.includes('h1' as CommandType) ||
      firstCommand.includes('h2' as CommandType) ||
      firstCommand.includes('h3' as CommandType))
  ) {
    return 'editor-text-style' // Иконка для заголовков (TT)
  }

  // Если это массив с командами списков
  if (
    Array.isArray(firstCommand) &&
    (firstCommand.includes('bulletList' as CommandType) ||
      firstCommand.includes('orderedList' as CommandType))
  ) {
    return 'editor-list' // Иконка для списков
  }

  // Если это массив с командами врезок/выравниваний
  if (
    Array.isArray(firstCommand) &&
    (firstCommand.includes('blockquote' as CommandType) ||
      firstCommand.includes('align-left' as CommandType) ||
      firstCommand.includes('align-center' as CommandType) ||
      firstCommand.includes('align-right' as CommandType))
  ) {
    return 'editor-blockquote' // Иконка для врезок/выравниваний
  }

  // По умолчанию
  return 'editor-more'
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

  // Для группового действия (выпадающее меню)
  const action = props.action as CommandGroupType

  // Определяем иконку на основе первой группы команд в выпадающем меню
  const iconName = getDropdownIconName(MENU_GROUPS[action])

  const options: OptionGroup[] = [
    {
      title: t(capitalize(String(action))),
      options: MENU_GROUPS[action].map((item) => ({
        value: item,
        title: t(capitalize(item)),
        selected: props.currentFormats.has(item)
      })),
      selected: MENU_GROUPS[action]
        .map((_, i) => i)
        .filter((i) => props.currentFormats.has(MENU_GROUPS[action][i] as CommandType)),
      onChange: (option: Option) => {
        props.onAction(option.value as CommandType)
      }
    }
  ]

  return (
    <DropDown
      options={options}
      triggerCssClass={styles.dropdownTrigger}
      class={styles.dropdown}
      triggerContent={
        <div class={styles.dropdownTriggerContent}>
          <Icon name={iconName} />
          <Icon name="editor-chevron-down" class={styles.chevron} />
        </div>
      }
    />
  )
}

/**
 * Основная панель инструментов редактора
 * Использует ToolbarControl для рендеринга кнопок и Dropdown для групп.
 * Видимость управляется через CSS автоматически основанно на режиме
 */
export interface SimpleToolbarProps {
  position?: Position
  class?: string
  commands: (CommandType | CommandGroupType)[]
  onAction: (action: CommandType | CommandGroupType) => void
  currentFormats: Set<CommandType>
  mode?: ToolbarMode
  onClose?: () => void
  editorId?: string
}

export const SimpleToolbar: Component<SimpleToolbarProps> = (props) => {
  return (
    <div
      class={clsx(styles.toolbar, props.class)}
      style={props.position ? `top: ${props.position.top}px; left: ${props.position.left}px` : undefined}
      onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие при клике на тулбар
      data-editor-id={props.editorId}
      data-toolbar-mode={props.mode || 'float'}
      // Добавляем mousedown для предотвращения потери фокуса редактором
      onMouseDown={(e) => e.preventDefault()}
    >
      <For each={props.commands}>
        {(command) => (
          <ToolbarControl
            action={command}
            onAction={props.onAction}
            currentFormats={props.currentFormats}
          />
        )}
      </For>
    </div>
  )
}
