import { clsx } from 'clsx'
import { Component, For, Show, createSignal, onCleanup, onMount } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { CommandType } from '../lib/commands'
import { ToolbarControl } from './SimpleToolbar'

import styles from './PlusMenu.module.scss'

/**
 * Плавающее меню вставки контента
 *
 * Особенности:
 * - Кнопка "+" находится слева от редактора на уровне курсора
 * - Плейсхолдер внутри редактора показывает подсказку
 * - Подменю появляется под кнопкой плюс
 * - Поддержка вставки ссылок/видео/изображений/аудио/горизонтальной линии
 * - Закрытие по клику вне
 * - Плавные анимации
 */
export const PlusMenu: Component<{
  position: { top: number; left: number; isVisible?: boolean }
  isVisible: boolean
  onClose?: () => void
  onAction: (action: CommandType) => void
  currentFormats: Set<CommandType>
}> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false)
  const [menuRef, setMenuRef] = createSignal<HTMLDivElement>()

  // Закрываем меню только при клике вне компонента
  const handleClickOutside = (e: MouseEvent) => {
    const menu = menuRef()
    if (!menu?.contains(e.target as Node)) {
      setIsOpen(false)
    }
  }

  onMount(() => {
    // Добавляем обработчик с задержкой чтобы избежать конфликта с кликом по кнопке
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
  })

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside)
  })

  const handlePlusClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOpen(!isOpen())
  }

  const handleMenuItemClick = (action: string) => {
    props.onAction(action === 'horizontal-rule' ? ('hr' as CommandType) : (action as CommandType))
    setIsOpen(false)
    if (props.onClose) props.onClose()
  }

  // Определяем реальную видимость меню по обоим параметрам: isVisible и position.isVisible
  const isReallyVisible = () => props.isVisible && props.position.isVisible !== false

  // Обработчик клика по плейсхолдеру - должен установить фокус на редактор
  const handlePlaceholderClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Найдем ближайший редактор
    const editor = (e.target as HTMLElement).closest('.SimpleRichEditor_editor__content')

    // Устанавливаем фокус на редактор
    if (editor) {
      ;(editor as HTMLElement).focus()
    } else {
      // Если не нашли, пробуем найти по атрибуту contenteditable
      const editableContent = document.querySelector('[contenteditable="true"]')
      if (editableContent) {
        ;(editableContent as HTMLElement).focus()
      }
    }

    // Закрываем меню после клика
    setIsOpen(false)
  }

  return (
    <div
      ref={setMenuRef}
      class={clsx(styles.plusMenu, { [styles.visible]: isReallyVisible() })}
      style={{
        top: `${props.position.top}px`,
        left: `${props.position.left}px` // Используем точную позицию left
      }}
    >
      <button
        class={clsx(styles.plusButton, { [styles.active]: isOpen() })}
        onClick={handlePlusClick}
        title="Добавить контент"
      >
        <Icon name="editor-plus" />
      </button>

      <div class={styles.placeholder} onClick={handlePlaceholderClick}>
        Добавьте ссылку или нажмите плюс для вставки медиа
      </div>

      <Show when={isOpen()}>
        <div class={clsx(styles.menuItems, 'visible')} onClick={(e) => e.stopPropagation()}>
          <For each={['link', 'image', 'video', 'audio', 'horizontal-rule']}>
            {(action) => (
              <ToolbarControl
                action={action === 'horizontal-rule' ? ('hr' as CommandType) : (action as CommandType)}
                class={styles.menuItem}
                onAction={() => handleMenuItemClick(action)}
                currentFormats={props.currentFormats}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
