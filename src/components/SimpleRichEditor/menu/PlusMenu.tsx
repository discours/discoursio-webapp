import { clsx } from 'clsx'
import { Component, createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { Icon } from '~/components/_shared/Icon/Icon'
import { useLocalize } from '~/context/localize'
import { replaceSelection } from '../lib/empty'
import { afterAnimation, afterDOMUpdate, restoreSelectionAfter } from '../lib/timing'
import { CommandType } from '../lib/types'
import styles from './PlusMenu.module.scss'
import { ToolbarControl } from './SimpleToolbar'
/**
 * Обработчик действий из PlusMenu
 * @param action - тип команды
 * @param editor - ссылка на редактор
 * @param callbacks - набор колбэков для действий с UI
 */
export const handlePlusMenuAction = (
  action: CommandType,
  editor: HTMLElement | null,
  callbacks: {
    showLinkForm?: () => void
    showTooltipForm?: () => void
    showPreviewForm?: () => void
    showPreviewPlaceholder?: () => void
    showAudioUploader?: () => void
    showImageUploadModal?: () => void
    handleChange?: () => void
  }
): void => {
  switch (action) {
    case 'preview':
      // Показываем оверлей с placeholder для ввода URL
      if (editor && callbacks.showPreviewPlaceholder) {
        callbacks.showPreviewPlaceholder()
      }
      break
    case 'upload':
      // Сначала показываем модалку выбора типа (изображение/аудио)
      // Модалка сама откроет FileDialog после выбора типа
      if (callbacks.showImageUploadModal) {
        callbacks.showImageUploadModal()
      }
      break
    case 'separator':
    case 'hr':
      if (editor) {
        // Вставляем <hr> и новый параграф после него
        replaceSelection('<hr><p><br></p>', editor)
        if (callbacks.handleChange) callbacks.handleChange()
      }
      break
    default:
      // Для прочих команд передаем обработку дальше
      break
  }
}

/**
 * Обработчик форматирования врезки (incut)
 * @param action - тип команды форматирования или название класса
 * @returns функция, применяющая форматирование к выбранной врезке
 */
export const handleIncutFormatting = (action: string): ((el: HTMLElement) => boolean) => {
  return (incutElement: HTMLElement): boolean => {
    if (!incutElement) return false

    // Обрабатываем различные типы форматирования
    switch (action) {
      case 'align-left':
        incutElement.setAttribute('data-align', 'left')
        return true
      case 'align-center':
        incutElement.setAttribute('data-align', 'center')
        return true
      case 'align-right':
        incutElement.setAttribute('data-align', 'right')
        return true
      case 'bg-gray':
        incutElement.setAttribute('data-bg', 'gray')
        return true
      case 'bg-white':
        incutElement.setAttribute('data-bg', 'white')
        return true
      case 'bg-black':
        incutElement.setAttribute('data-bg', 'black')
        return true
      case 'bg-yellow':
        incutElement.setAttribute('data-bg', 'yellow')
        return true
      case 'bg-red':
        incutElement.setAttribute('data-bg', 'red')
        return true
      case 'bg-green':
        incutElement.setAttribute('data-bg', 'green')
        return true
      default:
        return false
    }
  }
}

/**
 * Плавающее меню вставки контента в стиле Telegraph
 *
 * Особенности:
 * - Кнопка "+" появляется слева от начала строки при вводе текста
 * - Упрощенное подменю с основными опциями (ссылка, изображение, видео)
 * - Минималистичный дизайн в стиле Telegraph
 * - Закрытие по клику вне
 * - Плавные анимации
 * - Оперативное обновление положения при движении курсора
 */
export const PlusMenu: Component<{
  top: number
  left: number
  isVisible: boolean
  onEmpty?: boolean
  onClose?: () => void
  onAction: (action: CommandType) => void
  editorId?: string
  isFormActive?: boolean
}> = (props) => {
  console.log('[PlusMenu] Component created with props:', props)
  console.log('[PlusMenu] Top:', props.top)
  console.log('[PlusMenu] isVisible:', props.isVisible)
  const [isOpen, setIsOpen] = createSignal(false)
  const [menuRef, setMenuRef] = createSignal<HTMLDivElement>()
  const [isAppearing, setIsAppearing] = createSignal(false)

  // Эффект плавного появления меню - упрощенная логика
  createEffect(() => {
    if (props.isVisible) {
      // Установим флаг появления с небольшой задержкой для анимации (DRY: timing)
      afterAnimation(() => setIsAppearing(true))
    } else {
      setIsAppearing(false)
    }
  })

  // Закрываем меню только при клике вне компонента
  const handleClickOutside = (e: MouseEvent) => {
    const menu = menuRef()
    if (!menu?.contains(e.target as Node)) {
      setIsOpen(false)
    }
  }

  onMount(() => {
    // Добавляем обработчик с задержкой чтобы избежать конфликта с кликом по кнопке (DRY: timing)
    afterDOMUpdate(() => {
      document.addEventListener('click', handleClickOutside)
    })
  })

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside)
  })

  const handlePlusClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Сохраняем текущую селекцию перед открытием меню
    const selection = window.getSelection()
    const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null

    setIsOpen(!isOpen())

    // Восстанавливаем селекцию после небольшой задержки (DRY: timing)
    if (savedRange) {
      restoreSelectionAfter(() => {
        const newSelection = window.getSelection()
        if (newSelection) {
          newSelection.removeAllRanges()
          newSelection.addRange(savedRange)
        }
      })
    }
  }
  const handleMenuItemClick = (action: string) => {
    // Сохраняем селекцию перед выполнением действия
    const selection = window.getSelection()
    const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null

    props.onAction(action === 'horizontal-rule' ? ('hr' as CommandType) : (action as CommandType))
    setIsOpen(false)

    // Восстанавливаем селекцию после выполнения действия (DRY: timing)
    if (savedRange) {
      restoreSelectionAfter(() => {
        const newSelection = window.getSelection()
        if (newSelection) {
          newSelection.removeAllRanges()
          newSelection.addRange(savedRange)
        }
      })
    }

    if (props.onClose) props.onClose()
  }

  // Editor использует ограниченный набор элементов меню
  const editorMenuItems = ['upload', 'preview', 'separator']

  // Отладочная информация
  console.log('[PlusMenu] Render:', {
    isVisible: props.isVisible,
    isAppearing: isAppearing(),
    top: props.top,
    'props.top type': typeof props.top,
    'final style top': `${props.top}px`
  })
  const { t } = useLocalize()
  return (
    <div
      ref={setMenuRef}
      class={clsx(styles.plusMenu, {
        [styles.visible]: props.isVisible,
        [styles.appearing]: isAppearing()
      })}
      style={{
        position: 'fixed',
        top: `${props.top}px`,
        left: `${props.left}px`,
        'z-index': 1000
      }}
    >
      <div class={styles.menuWrapper}>
        <button
          class={clsx(styles.plusButton, { [styles.active]: isOpen() })}
          onClick={handlePlusClick}
          onMouseDown={(e) => e.preventDefault()}
          title={t('Add a link or click plus to embed media')}
        >
          <Icon name="editor-plus" />
        </button>
      </div>

      <Show when={isOpen()}>
        <div
          class={clsx(styles.menuItems, styles.visible)}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()} // Предотвращаем потерю фокуса
        >
          <For each={editorMenuItems}>
            {(action) => (
              <ToolbarControl
                action={action as CommandType}
                class={styles.menuItem}
                onAction={() => handleMenuItemClick(action)}
                currentFormats={new Set()}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
