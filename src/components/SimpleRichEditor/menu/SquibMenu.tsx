import { clsx } from 'clsx'
import { Component, createSignal, onMount, Show } from 'solid-js'
import { CommandGroupType, CommandType, Position } from '../lib/types'
import { SimpleToolbar } from './SimpleToolbar'

import styles from './SquibMenu.module.scss'

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
  position: Position
  /** Идентификатор редактора */
  editorId?: string
  /** Набор команд для меню форматирования врезки */
  commands: (CommandType | CommandGroupType)[]
  /** Текущий элемент подвёрстки */
  squibElement?: HTMLElement | null
}

/**
 * Меню форматирования подвёрстки (squib)
 * Подвёрстка — это выделенный блок текста с особым оформлением (цвет фона, выравнивание)
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
  // Содержимое подвёрстки
  const [squibContent, setSquibContent] = createSignal('')

  let contentEditableRef: HTMLDivElement | undefined

  // Загружаем содержимое при монтировании
  onMount(() => {
    if (props.squibElement) {
      setSquibContent(props.squibElement.textContent || '')
    }
  })

  // Обработчик кнопки закрытия
  const handleClose = () => {
    if (props.onClose) props.onClose()
  }

  // Обработчик изменения контента
  const handleContentInput = (e: InputEvent) => {
    const target = e.target as HTMLDivElement
    const newContent = target.textContent || ''
    setSquibContent(newContent)

    // Обновляем содержимое элемента подвёрстки
    if (props.squibElement) {
      props.squibElement.textContent = newContent
    }
  }

  // Стиль позиционирования меню над врезкой
  const menuStyle = {
    top: `${props.position.top}px`,
    left: `${props.position.left}px`
  }

  return (
    <div
      class={clsx(styles.squibMenu, {
        [styles.visible]: props.isVisible
      })}
      style={menuStyle}
      data-editor-id={props.editorId}
    >
      <div class={styles.squibMenuHeader}>
        {/* Иконки выравнивания */}
        <div class={styles.alignButtons}>
          <button
            onClick={() => props.onAction('align-left')}
            class={clsx(styles.alignButton, {
              [styles.active]: props.currentFormats.has('align-left')
            })}
            title="Влево"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12M2 6h8M2 9h12M2 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
          <button
            onClick={() => props.onAction('align-center')}
            class={clsx(styles.alignButton, {
              [styles.active]: props.currentFormats.has('align-center')
            })}
            title="По центру"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12M4 6h8M2 9h12M4 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
          <button
            onClick={() => props.onAction('align-right')}
            class={clsx(styles.alignButton, {
              [styles.active]: props.currentFormats.has('align-right')
            })}
            title="Вправо"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12M6 6h8M2 9h12M6 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <button onClick={handleClose} class={styles.closeButton} title="Скрыть меню">
          ×
        </button>
      </div>

      {/* Редактируемое поле */}
      <div class={styles.squibMenuContent}>
        <div
          ref={contentEditableRef}
          class={styles.editableContent}
          contentEditable={true}
          onInput={handleContentInput}
          innerHTML={squibContent()}
          data-placeholder="Введите текст подвёрстки..."
        />
      </div>
    </div>
  )
}
