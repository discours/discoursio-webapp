import { clsx } from 'clsx'
import { CommandType, Position } from '../lib/types'

import styles from './SquibMenu.module.scss'

interface SquibMenuProps {
  /** Видимость меню */
  isVisible: boolean
  /** Обработчик команд форматирования */
  onAction: (action: CommandType) => void
  /** Обработчик закрытия меню */
  onClose: () => void
  /** Текущие форматы */
  currentFormats: Set<CommandType>
  /** Позиция меню */
  position: Position
  /** Идентификатор редактора */
  editorId?: string
  /** Набор команд для меню форматирования врезки */
  commands: CommandType[]
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
export const SquibMenu = (props: SquibMenuProps) => {
  // Обработчик кнопки закрытия
  const handleClose = () => {
    if (props.onClose) props.onClose()
  }

  // Получаем текущее выравнивание из squibElement (реактивно)
  const getCurrentAlign = () => {
    const element = props.squibElement
    return element?.getAttribute('data-align') || 'left'
  }

  // Стиль позиционирования меню над врезкой (по центру верхней границы)
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
        <div class={styles.controls}>
          {/* Иконки выравнивания */}
          <div class={styles.alignButtons}>
            <button
              onClick={() => props.onAction('align-left')}
              class={clsx(styles.alignButton, {
                [styles.active]: getCurrentAlign() === 'left'
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
                [styles.active]: getCurrentAlign() === 'center'
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
                [styles.active]: getCurrentAlign() === 'right'
              })}
              title="Вправо"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 3h12M6 6h8M2 9h12M6 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <button onClick={handleClose} class={styles.closeButton} title="Скрыть меню">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
