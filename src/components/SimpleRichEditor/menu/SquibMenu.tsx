import { clsx } from 'clsx'
import { Component } from 'solid-js'
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
  // Обработчик кнопки закрытия
  const handleClose = () => {
    if (props.onClose) props.onClose()
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
        <div class={styles.controls}>
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

          {/* Выбор цвета подложки */}
          <div class={styles.colorButtons}>
            <button
              onClick={() => props.onAction('bg-gray')}
              class={clsx(styles.colorButton, {
                [styles.active]: props.currentFormats.has('bg-gray')
              })}
              title="Серый фон"
            >
              <span class={styles.colorSwatch} data-color="bg-gray" />
            </button>
            <button
              onClick={() => props.onAction('bg-white')}
              class={clsx(styles.colorButton, {
                [styles.active]: props.currentFormats.has('bg-white')
              })}
              title="Белый фон"
            >
              <span class={styles.colorSwatch} data-color="bg-white" />
            </button>
            <button
              onClick={() => props.onAction('bg-black')}
              class={clsx(styles.colorButton, {
                [styles.active]: props.currentFormats.has('bg-black')
              })}
              title="Чёрный фон"
            >
              <span class={styles.colorSwatch} data-color="bg-black" />
            </button>
            <button
              onClick={() => props.onAction('bg-yellow')}
              class={clsx(styles.colorButton, {
                [styles.active]: props.currentFormats.has('bg-yellow')
              })}
              title="Жёлтый фон"
            >
              <span class={styles.colorSwatch} data-color="bg-yellow" />
            </button>
            <button
              onClick={() => props.onAction('bg-red')}
              class={clsx(styles.colorButton, {
                [styles.active]: props.currentFormats.has('bg-red')
              })}
              title="Красный фон"
            >
              <span class={styles.colorSwatch} data-color="bg-red" />
            </button>
            <button
              onClick={() => props.onAction('bg-green')}
              class={clsx(styles.colorButton, {
                [styles.active]: props.currentFormats.has('bg-green')
              })}
              title="Зелёный фон"
            >
              <span class={styles.colorSwatch} data-color="bg-green" />
            </button>
          </div>
        </div>

        <button onClick={handleClose} class={styles.closeButton} title="Скрыть меню">
          ×
        </button>
      </div>
    </div>
  )
}
