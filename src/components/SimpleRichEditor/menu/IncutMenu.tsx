import { clsx } from 'clsx'
import { createSignal, Show } from 'solid-js'
import { CommandType, Position } from '../lib/types'

import styles from './IncutMenu.module.scss'

interface IncutMenuProps {
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
  incutElement?: HTMLElement | null
}

/**
 * Меню форматирования подвёрстки (incut)
 * Подвёрстка — это выделенный блок текста с особым оформлением (цвет фона, выравнивание)
 *
 * @example
 * ```tsx
 * <IncutMenu
 *   isVisible={showMenu()}
 *   onAction={handleFormat}
 *   onClose={() => setShowMenu(false)}
 *   currentFormats={activeFormats()}
 *   position={{ top: 100, left: 200 }}
 *   editorId="main-editor"
 * />
 * ```
 */
export const IncutMenu = (props: IncutMenuProps) => {
  // State для выпадающего меню цветов
  const [showColorPicker, setShowColorPicker] = createSignal(false)

  // Обработчик кнопки закрытия
  const handleClose = () => {
    if (props.onClose) props.onClose()
  }

  // Получаем текущее выравнивание из incutElement (реактивно)
  const getCurrentAlign = () => {
    const element = props.incutElement
    return element?.getAttribute('data-align') || 'left'
  }

  // Получаем текущий цвет фона из incutElement (реактивно)
  const getCurrentBg = () => {
    const element = props.incutElement
    return element?.getAttribute('data-bg') || 'none'
  }

  // Доступные цвета фона
  const bgColors = [
    { value: 'none', label: 'Без фона (рамка)', color: 'transparent', border: true },
    { value: 'gray', label: 'Серый', color: '#9ca3af' },
    { value: 'yellow', label: 'Желтый', color: '#fbbf24' },
    { value: 'red', label: 'Красный', color: '#f87171' },
    { value: 'green', label: 'Зеленый', color: '#34d399' },
    { value: 'black', label: 'Черный', color: '#1f2937' }
  ]

  // Обработчик выбора цвета
  const handleBgChange = (bgValue: string) => {
    if (bgValue === 'none') {
      // Убираем атрибут data-bg для отображения рамки
      if (props.incutElement) {
        props.incutElement.removeAttribute('data-bg')
        // Вызываем onChange через фиктивную команду для сохранения
        props.onAction('align-left' as CommandType)
      }
    } else {
      // Устанавливаем цвет через команду форматирования
      props.onAction(`bg-${bgValue}` as CommandType)
    }
    setShowColorPicker(false)
  }

  // Получаем текущий цвет для отображения в кнопке
  const getCurrentColorOption = () => {
    const bg = getCurrentBg()
    return bgColors.find((c) => c.value === bg) || bgColors[0]
  }

  // Стиль позиционирования меню над врезкой (по центру верхней границы)
  const menuStyle = {
    top: `${props.position.top}px`,
    left: `${props.position.left}px`
  }

  return (
    <div
      class={clsx(styles.incutMenu, {
        [styles.visible]: props.isVisible
      })}
      style={menuStyle}
      data-editor-id={props.editorId}
    >
      <div class={styles.incutMenuContainer}>
        {/* Первая строка: выравнивание + цвет + закрыть */}
        <div class={styles.incutMenuHeader}>
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

          <button
            onClick={() => setShowColorPicker(!showColorPicker())}
            class={clsx(styles.colorPickerButton, {
              [styles.active]: showColorPicker()
            })}
            title={getCurrentColorOption().label}
          >
            <div
              class={styles.colorIndicator}
              style={{
                'background-color': getCurrentColorOption().color,
                border: getCurrentColorOption().border ? '2px solid #d1d5db' : 'none'
              }}
            />
          </button>

          <button onClick={handleClose} class={styles.closeButton} title="Скрыть меню">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        {/* Вторая строка: выбор цвета */}
        <Show when={showColorPicker()}>
          <div class={styles.colorRow}>
            {bgColors.map((colorOption) => (
              <button
                class={clsx(styles.colorOption, {
                  [styles.active]: getCurrentBg() === colorOption.value
                })}
                onClick={() => handleBgChange(colorOption.value)}
                title={colorOption.label}
              >
                <div
                  class={styles.colorSwatch}
                  style={{
                    'background-color': colorOption.color,
                    border: colorOption.border ? '2px solid #d1d5db' : '2px solid rgba(0, 0, 0, 0.1)'
                  }}
                />
              </button>
            ))}
          </div>
        </Show>
      </div>
    </div>
  )
}
