import { clsx } from 'clsx'
import { Component, For, Show, createSignal, onCleanup, onMount } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { CommandType } from '../lib/commands'
import { Position } from '../lib/types'
import { ToolbarControl } from './SimpleToolbar'

import styles from './PlusMenu.module.scss'

/**
 * Плавающее меню вставки контента
 *
 * Особенности:
 * - Кнопка "+" для открытия
 * - Поддержка вставки ссылок/видео/изображений
 * - Интеграция с InlineForm компонентами
 * - Закрытие по клику вне
 * Следует за курсором только по вертикали
 */
export const PlusMenu: Component<{
  position: Position
  isVisible: boolean
  onClose?: () => void
  onAction: (action: CommandType) => void
  currentFormats: Set<CommandType>
}> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false)
  const [menuRef, setMenuRef] = createSignal<HTMLDivElement>()

  // Закрываем меню при клике вне
  const handleClickOutside = (e: MouseEvent) => {
    const menu = menuRef()
    if (menu && !menu.contains(e.target as Node)) {
      setIsOpen(false)
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside)
  })

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside)
  })

  return (
    <div
      ref={setMenuRef}
      class={clsx(styles.plusMenu, { [styles.visible]: props.isVisible })}
      style={{
        top: `${props.position.top}px`,
        left: '0px' // Фиксированное положение слева
      }}
    >
      <button
        class={clsx(styles.plusButton, { [styles.active]: isOpen() })}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen())
        }}
        title="Добавить контент"
      >
        <Icon name="editor-plus" />
      </button>

      <Show when={isOpen()}>
        <div class={styles.menuItems}>
          <For each={['image', 'video', 'audio', 'hr']}>
            {(action) => (
              <ToolbarControl
                action={action as CommandType}
                class={styles.menuItem}
                onAction={() => {
                  props.onAction(action as CommandType)
                  setIsOpen(false)
                }}
                currentFormats={props.currentFormats}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
