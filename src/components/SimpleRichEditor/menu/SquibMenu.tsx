import { Component, For, Show, createSignal, onMount } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { capitalize } from '~/utils/capitalize'
import { Icon } from '../../_shared/Icon'
import { CommandType } from '../lib/commands'

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
 * />
 * ```
 */
export const SquibMenu: Component<SquibMenuProps> = (props) => {
  const { t } = useLocalize()
  const ALIGN_COMMANDS = ['align-left', 'align-center', 'align-right'] as const
  const BG_COMMANDS = ['bg-gray', 'bg-white', 'bg-black', 'bg-yellow', 'bg-red', 'bg-green'] as const
  const [menuRef, setMenuRef] = createSignal<HTMLDivElement>()

  // Позиционируем по центру поля ввода
  onMount(() => {
    const editor = menuRef()?.closest('.editor')
    if (editor) {
      const rect = editor.getBoundingClientRect()
      menuRef()?.style.setProperty('left', `${rect.width / 2}px`)
    }
  })

  return (
    <Show when={props.isVisible}>
      <div ref={setMenuRef} class={styles.squibMenu}>
        <div class={styles.group}>
          <For each={ALIGN_COMMANDS}>
            {(action) => (
              <button
                class={styles.button}
                classList={{ [styles.active]: props.currentFormats.has(action as CommandType) }}
                onClick={() => props.onAction(action)}
                title={t(capitalize(action))}
              >
                <Icon name={`editor-${action}`} />
              </button>
            )}
          </For>
        </div>

        <div class={styles.group}>
          <For each={BG_COMMANDS}>
            {(color) => (
              <button
                class={styles.colorButton}
                classList={{ [styles.active]: props.currentFormats.has(color as CommandType) }}
                onClick={() => props.onAction(color)}
                title={t(capitalize(color))}
              >
                <span class={styles.colorSwatch} data-color={color} />
              </button>
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}
