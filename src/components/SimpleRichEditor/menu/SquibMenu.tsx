import { clsx } from 'clsx'
import { Component, Show, createSignal } from 'solid-js'
import { CommandGroupType, CommandType } from '../lib/commands'
import { SimpleToolbar } from './SimpleToolbar'

import styles from './SquibMenu.module.scss'

/**
 * Тип позиции меню
 */
export interface MenuPosition {
  top: number
  left: number
  isVisible?: boolean
}

interface SquibMenuProps {
  /** Видимость меню */
  isVisible: boolean
  /** Обработчик команд форматирования */
  onAction: (action: CommandType | CommandGroupType) => void
  /** Обработчик закрытия меню */
  onClose: () => void
  /** Текущие форматы */
  currentFormats: Set<CommandType>
  /** Позиция меню */
  position: { top: number; left: number; isVisible?: boolean }
  /** Идентификатор редактора */
  editorId?: string
  /** Набор команд для меню форматирования врезки */
  commands: (CommandType | CommandGroupType)[]
}

/**
 * Меню форматирования сквиба (подвёрстки)
 *
 * @example
 * ```tsx
 * <SquibMenu
 *   isVisible={showMenu()}
 *   onAction={handleFormat}
 *   onClose={() => setShowMenu(false)}
 *   currentFormats={activeFormats()}
 *   position={{ top: 100, left: 200 }}
 *   editorId="main-editor"
 * />
 * ```
 */
export const SquibMenu: Component<SquibMenuProps> = (props) => {
  // Сигнал для состояния формы
  const [formTab, setFormTab] = createSignal<'content' | 'style'>('style')

  // Обработчик кнопки закрытия
  const handleClose = () => {
    if (props.onClose) props.onClose()
  }

  // Стиль позиционирования меню над врезкой
  const menuStyle = {
    top: `${props.position.top}px`,
    left: `${props.position.left}px`
  }

  // Устанавливаем вкладку "Стиль" по умолчанию
  return (
    <div
      class={clsx(styles.squibMenu, {
        [styles.visible]: props.isVisible && props.position.isVisible !== false
      })}
      style={menuStyle}
      data-editor-id={props.editorId}
    >
      <div class={styles.squibMenuHeader}>
        <button
          onClick={() => setFormTab('content')}
          class={clsx(styles.tabButton, {
            [styles.active]: formTab() === 'content'
          })}
        >
          Текст
        </button>
        <button
          onClick={() => setFormTab('style')}
          class={clsx(styles.tabButton, {
            [styles.active]: formTab() === 'style'
          })}
        >
          Стиль
        </button>
        <button onClick={handleClose} class={styles.closeButton}>
          ×
        </button>
      </div>

      <Show when={formTab() === 'style'}>
        <div class={styles.squibMenuStyle}>
          <SimpleToolbar
            commands={props.commands}
            onAction={props.onAction}
            currentFormats={props.currentFormats}
            isVisible={props.isVisible}
          />
        </div>
      </Show>

      <Show when={formTab() === 'content'}>
        <div class={styles.squibMenuContent}>
          <p>Редактирование врезки по двойному клику на тексте</p>
        </div>
      </Show>
    </div>
  )
}
