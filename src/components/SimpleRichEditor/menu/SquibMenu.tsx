import { clsx } from 'clsx'
import { Component, createSignal } from 'solid-js'
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
export const SquibMenu: Component<SquibMenuProps> = (props) => {
  // Состояние dropdown для выбора цвета
  const [showColorDropdown, setShowColorDropdown] = createSignal(false)

  // Обработчик кнопки закрытия
  const handleClose = () => {
    if (props.onClose) props.onClose()
  }

  // Получаем текущее выравнивание и фон из squibElement
  const getCurrentAlign = () => props.squibElement?.getAttribute('data-align') || 'left'
  const getCurrentBg = () => props.squibElement?.getAttribute('data-bg') || ''

  // Обработчик выбора цвета
  const handleColorSelect = (color: string) => {
    props.onAction(color as CommandType)
    setShowColorDropdown(false)
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

          {/* Выбор цвета подложки через dropdown */}
          <div class={styles.colorPicker}>
            <button
              onClick={() => setShowColorDropdown(!showColorDropdown())}
              class={clsx(styles.colorPickerButton, {
                [styles.active]: getCurrentBg() !== ''
              })}
              title="Цвет фона"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.5" fill="none" />
                <circle cx="8" cy="8" r="2" fill="currentColor" />
              </svg>
            </button>
            {showColorDropdown() && (
              <div class={styles.colorDropdown}>
                <button
                  onClick={() => handleColorSelect('bg-gray')}
                  class={clsx(styles.colorOption, {
                    [styles.active]: getCurrentBg() === 'gray'
                  })}
                >
                  <span class={styles.colorSwatch} data-color="bg-gray" />
                  <span>Серый</span>
                </button>
                <button
                  onClick={() => handleColorSelect('bg-white')}
                  class={clsx(styles.colorOption, {
                    [styles.active]: getCurrentBg() === 'white'
                  })}
                >
                  <span class={styles.colorSwatch} data-color="bg-white" />
                  <span>Белый</span>
                </button>
                <button
                  onClick={() => handleColorSelect('bg-black')}
                  class={clsx(styles.colorOption, {
                    [styles.active]: getCurrentBg() === 'black'
                  })}
                >
                  <span class={styles.colorSwatch} data-color="bg-black" />
                  <span>Чёрный</span>
                </button>
                <button
                  onClick={() => handleColorSelect('bg-yellow')}
                  class={clsx(styles.colorOption, {
                    [styles.active]: getCurrentBg() === 'yellow'
                  })}
                >
                  <span class={styles.colorSwatch} data-color="bg-yellow" />
                  <span>Жёлтый</span>
                </button>
                <button
                  onClick={() => handleColorSelect('bg-red')}
                  class={clsx(styles.colorOption, {
                    [styles.active]: getCurrentBg() === 'red'
                  })}
                >
                  <span class={styles.colorSwatch} data-color="bg-red" />
                  <span>Красный</span>
                </button>
                <button
                  onClick={() => handleColorSelect('bg-green')}
                  class={clsx(styles.colorOption, {
                    [styles.active]: getCurrentBg() === 'green'
                  })}
                >
                  <span class={styles.colorSwatch} data-color="bg-green" />
                  <span>Зелёный</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <button onClick={handleClose} class={styles.closeButton} title="Скрыть меню">
          ×
        </button>
      </div>
    </div>
  )
}
