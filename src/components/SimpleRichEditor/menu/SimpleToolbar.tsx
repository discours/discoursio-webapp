import { clsx } from 'clsx'
import { Component, createEffect, createSignal, For, JSX, Show } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { Popover } from '~/components/_shared/Popover'
import { Popup } from '~/components/_shared/Popup'
import { useLocalize } from '~/context/localize'
import { capitalize } from '~/utils/capitalize'
import { CommandGroupType, CommandType, Position } from '../lib/types'
import { isGroup, MENU_GROUPS } from './config'

import styles from './SimpleToolbar.module.scss'

type ToolbarDropdownOption = {
  value: string | number
  title: string
  selected?: boolean
  icon?: string
  customRender?: boolean
}

type ToolbarDropdownOptionGroup = {
  title?: string
  options: ToolbarDropdownOption[]
  selected?: number[]
  onChange: (option: ToolbarDropdownOption) => void
}

type ToolbarDropdownProps = {
  options: ToolbarDropdownOptionGroup[]
  triggerCssClass?: string
  class?: string
  triggerContent: JSX.Element
}

/**
 * Кастомный рендер для кнопок с заголовками (H1, H2, H3)
 */
const renderHeadingButton = (option: ToolbarDropdownOption, isActive: boolean, onClick: () => void) => {
  // Определяем размер шрифта на основе типа заголовка
  let fontSize = '20px'
  if (option.value === 'h2') fontSize = '18px'
  if (option.value === 'h3') fontSize = '16px'

  return (
    <button class={clsx(styles.dropdownOptionButton, { [styles.active]: isActive })} onClick={onClick}>
      <span style={{ 'font-size': fontSize, 'font-weight': '600' }}>{option.title}</span>
    </button>
  )
}

/**
 * Компонент выпадающего меню для тулбара редактора.
 * Показывает список опций, сгруппированных по категориям.
 */
const ToolbarDropdown: Component<ToolbarDropdownProps> = (props) => {
  const [_isOpen, setIsOpen] = createSignal(false)
  const renderOptionButton = (
    option: ToolbarDropdownOption,
    isActive: boolean,
    onChange: (option: ToolbarDropdownOption) => void
  ) => {
    // Если указан customRender и это один из заголовков, используем специальный рендер
    if (option.customRender && ['h1', 'h2', 'h3'].includes(option.value as string)) {
      return renderHeadingButton(option, isActive, () => onChange(option))
    }

    // Стандартный рендер для остальных опций - только иконка
    return (
      <button
        class={clsx(styles.dropdownOptionButton, styles.iconOnly, { [styles.active]: isActive })}
        onClick={() => onChange(option)}
        title={option.title} // Добавляем title для подсказки при наведении
      >
        {option.icon && <Icon name={option.icon} class={clsx(styles.optionIcon, { [styles.active]: isActive })} />}
        {/* Текст убран, оставлена только иконка */}
      </button>
    )
  }

  return (
    <Popup
      trigger={<button class={clsx(styles.dropdownTrigger, props.triggerCssClass)}>{props.triggerContent}</button>}
      onVisibilityChange={setIsOpen}
      popupCssClass={clsx(styles.dropdown, styles.noBorderRadiusPopup, props.class)}
      variant="tiny"
    >
      <div class={styles.dropdownContent}>
        <For each={props.options}>
          {(group, groupIndex) => (
            <>
              {/* Показываем разделитель между группами */}
              <Show when={groupIndex() > 0}>
                <div class={styles.dropdownDivider} />
              </Show>

              {/* Заголовок группы */}
              <Show when={group.title}>
                <div class={styles.dropdownGroupTitle}>{group.title}</div>
              </Show>

              {/* Опции группы */}
              <ul class={styles.dropdownOptionsList}>
                <For each={group.options}>
                  {(option, optionIndex) => (
                    <li>
                      {renderOptionButton(
                        option,
                        group.selected && Array.isArray(group.selected)
                          ? group.selected.includes(optionIndex())
                          : false,
                        group.onChange
                      )}
                    </li>
                  )}
                </For>
              </ul>
            </>
          )}
        </For>
      </div>
    </Popup>
  )
}

export type ToolbarCommands = readonly (CommandType | CommandGroupType | readonly (readonly CommandType[])[] | '')[]
export type ToolbarMode = 'top' | 'bottom' | 'float'

/**
 * Определяет иконку для Dropdown на основе массива команд (для нового формата).
 * Использует новые имена иконок `editor-*`.
 */
const getDropdownIconForNestedGroup = (group: readonly (readonly CommandType[])[]): string => {
  if (!group || group.length === 0 || !group[0] || group[0].length === 0) {
    return 'editor-more' // Иконка по умолчанию
  }
  const firstCommandInFirstGroup = group[0][0]
  // Используем новые имена иконок
  if (['h1', 'h2', 'h3'].includes(firstCommandInFirstGroup)) return 'editor-text-size' // Иконка "TT"
  if (['bulletList', 'orderedList'].includes(firstCommandInFirstGroup)) return 'editor-ul' // Иконка дропдауна для списков
  if (['blockquote', 'punchline', 'incut'].includes(firstCommandInFirstGroup)) return 'editor-quote' // Иконка цитаты как иконка дропдауна
  return 'editor-more'
}

/**
 * Определяет иконку для Dropdown на основе имени группы (для старого формата).
 * Использует новые имена иконок `editor-*`.
 */
const getDropdownIconForGroupName = (groupName: CommandGroupType): string => {
  const commands = MENU_GROUPS[groupName]
  if (!commands || commands.length === 0) return 'editor-more'
  const firstCommand = commands[0]
  // Используем новые имена иконок
  if (['h1', 'h2', 'h3'].includes(firstCommand)) return 'editor-text-size'
  if (['bulletList', 'orderedList'].includes(firstCommand)) return 'editor-ul'
  if (['blockquote', 'punchline', 'incut'].includes(firstCommand)) return 'editor-quote'
  return 'editor-more'
}

// Восстановленный ToolbarControl с добавленной логикой для массивов
export const ToolbarControl: Component<{
  action: CommandType | CommandGroupType | readonly (readonly CommandType[])[] // Принимает и строки, и массивы
  onAction: (action: CommandType) => void // Колбэк всегда с конкретной командой
  currentFormats: Set<CommandType>
  class?: string
}> = (props) => {
  const { t } = useLocalize()

  // --- Обработка случая, когда action - это массив --- (Новая логика)
  if (Array.isArray(props.action)) {
    const group = props.action as readonly (readonly CommandType[])[]
    // Проверка на корректность массива
    if (group.length === 0 || !Array.isArray(group[0])) {
      return null
    }

    const iconName = getDropdownIconForNestedGroup(group)

    // --- Обновленная логика для опций ToolbarDropdown ---
    const options: ToolbarDropdownOptionGroup[] = group.map((subGroup, index) => {
      // Определяем заголовок группы на основе индекса или содержимого группы
      let groupTitle = ''
      if (iconName === 'editor-text-size') {
        // Дропдаун "TT"
        groupTitle = index === 0 ? t('Headers') : t('Blocks') // Заголовки, Блоки
      } else if (iconName === 'editor-ul') {
        // Дропдаун "Списки"
        groupTitle = t('Lists') // Списки
      }

      return {
        title: groupTitle,
        options: subGroup.map((item) => ({
          value: item,
          title: ['h1', 'h2', 'h3'].includes(item) ? item.toUpperCase() : t(capitalize(item) as string),
          // Используем новые иконки для списков
          icon: item === 'bulletList' ? 'editor-ul' : item === 'orderedList' ? 'editor-ol' : `editor-${item}`,
          selected: props.currentFormats.has(item),
          // Добавляем флаг для кастомного рендеринга заголовков
          customRender: ['h1', 'h2', 'h3'].includes(item)
        })),
        selected: subGroup.map((_, i) => i).filter((i) => props.currentFormats.has(subGroup[i])) || [],
        onChange: (option: ToolbarDropdownOption) => {
          props.onAction(option.value as CommandType)
        }
      }
    })

    return (
      <ToolbarDropdown
        options={options}
        triggerCssClass={styles.dropdownTrigger}
        class={styles.dropdown}
        triggerContent={
          <div class={styles.dropdownTriggerContent}>
            {/* Используем актуальную иконку дропдауна */}
            <Icon name={iconName} />
            {/* Используем иконку треугольника */}
            <Icon name="down-triangle" class={styles.chevron} />
          </div>
        }
      />
    )
  }

  // --- Обработка случая, когда action - это строка --- (Старая логика с небольшими адаптациями)
  const actionStr = props.action as CommandType | CommandGroupType

  // Если это имя группы
  if (isGroup(actionStr)) {
    const groupName = actionStr as CommandGroupType
    const iconName = getDropdownIconForGroupName(groupName)
    const groupCommands = MENU_GROUPS[groupName]

    if (!groupCommands) return null

    // Строим опции ToolbarDropdown из MENU_GROUPS, добавляя иконки
    const options: ToolbarDropdownOptionGroup[] = [
      {
        title: t(capitalize(groupName) as string), // Используем имя группы как заголовок
        options: groupCommands.map((item) => ({
          value: item,
          title: ['h1', 'h2', 'h3'].includes(item) ? item.toUpperCase() : t(capitalize(item) as string),
          // Используем новые иконки для списков
          icon: item === 'bulletList' ? 'editor-ul' : item === 'orderedList' ? 'editor-ol' : `editor-${item}`,
          selected: props.currentFormats.has(item),
          // Добавляем флаг для кастомного рендеринга заголовков
          customRender: ['h1', 'h2', 'h3'].includes(item)
        })),
        selected: groupCommands.map((_, i) => i).filter((i) => props.currentFormats.has(groupCommands[i])) || [],
        onChange: (option: ToolbarDropdownOption) => {
          props.onAction(option.value as CommandType) // Вызываем колбэк с выбранной командой
        }
      }
    ]

    return (
      <ToolbarDropdown
        options={options}
        triggerCssClass={styles.dropdownTrigger}
        class={styles.dropdown}
        triggerContent={
          <div class={styles.dropdownTriggerContent}>
            {/* Используем актуальную иконку дропдауна */}
            <Icon name={iconName} />
            {/* Используем иконку треугольника */}
            <Icon name="down-triangle" class={styles.chevron} />
          </div>
        }
      />
    )
  }

  // Если это одиночная команда (строка, не являющаяся группой)
  const command = actionStr as CommandType

  // Определяем имя иконки для кнопки
  // Учитываем особые случаи для punchline и incut, если нужно
  let iconNameForButton = `editor-${command}`
  if (command === 'punchline') {
    iconNameForButton = 'editor-punchline' // Используем скачанную иконку
  }
  if (command === 'incut') {
    iconNameForButton = 'editor-incut' // Используем скачанную иконку
  }
  if (command === 'bulletList') {
    iconNameForButton = 'editor-ul' // Используем скачанную иконку
  }
  if (command === 'orderedList') {
    iconNameForButton = 'editor-ol' // Используем скачанную иконку
  }
  if (command === 'media' || command === 'upload') {
    iconNameForButton = 'editor-image' // Используем иконку изображения для медиа/upload
  }
  if (command === 'separator') {
    iconNameForButton = 'editor-hr' // Используем иконку разделителя для separator
  }

  return (
    <Popover content={capitalize(command) as string}>
      {(ref) => (
        <button
          ref={ref}
          onClick={() => props.onAction(command)} // Вызываем колбэк с этой командой
          class={clsx(styles.button, props.class, {
            [styles.active]: props.currentFormats.has(command)
          })}
          data-active={props.currentFormats.has(command) ? 'true' : undefined}
        >
          {/* Используем актуальное имя иконки */}
          <Icon name={iconNameForButton} />
        </button>
      )}
    </Popover>
  )
}

/**
 * Основная панель инструментов редактора.
 * Теперь корректно обрабатывает вложенные массивы для Dropdown.
 */
export interface SimpleToolbarProps {
  position?: Position
  class?: string
  commands: ToolbarCommands // Используем общий тип
  onAction: (action: CommandType) => void // Колбэк теперь всегда получает CommandType
  currentFormats: Set<CommandType>
  mode?: ToolbarMode
  onClose?: () => void
  editorId?: string
}

export const SimpleToolbar: Component<SimpleToolbarProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false)

  // Эффект для отладки состояния isOpen
  createEffect(() => {
    console.log('[SimpleToolbar] isOpen changed:', isOpen())
  })

  // Обновляем isOpen при изменении положения тулбара
  createEffect(() => {
    if (props.position) {
      setIsOpen(true)
      console.log('[SimpleToolbar] Position changed, setting isOpen to true', props.position)
    } else {
      setIsOpen(false)
      console.log('[SimpleToolbar] No position, setting isOpen to false')
    }
  })

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
        {(command) => {
          // Проверяем, является ли команда пустой строкой (разделителем)
          if (command === '') {
            return <div class={styles.separator} />
          }

          // ToolbarControl сам разберется, строка это или массив
          return (
            <ToolbarControl
              action={command as CommandType | CommandGroupType | readonly (readonly CommandType[])[]}
              onAction={props.onAction} // Просто передаем колбэк
              currentFormats={props.currentFormats}
            />
          )
        }}
      </For>
    </div>
  )
}
