import { clsx } from 'clsx'
import { Component, createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { Icon } from '~/components/_shared/Icon/Icon'
import { useLocalize } from '~/context/localize'
import { replaceSelection } from '../lib/empty'
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
    showEmbedForm?: () => void
    showAudioUploader?: () => void
    showImageUploadModal?: () => void
    handleChange?: () => void
  }
): void => {
  switch (action) {
    case 'embed':
      if (callbacks.showEmbedForm) {
        callbacks.showEmbedForm()
      }
      break
    case 'upload':
      // Создаем input для выбора файлов (изображения и аудио)
      {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*,audio/*'
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (!file) return

          // Определяем тип файла по MIME
          if (file.type.startsWith('image/')) {
            // Изображение - вызываем modal загрузки изображения
            if (callbacks.showImageUploadModal) {
              callbacks.showImageUploadModal()
              // Эмулируем выбор файла в modal
              setTimeout(() => {
                const fileInput = document.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement
                if (fileInput) {
                  const dataTransfer = new DataTransfer()
                  dataTransfer.items.add(file)
                  fileInput.files = dataTransfer.files
                  fileInput.dispatchEvent(new Event('change', { bubbles: true }))
                }
              }, 100)
            }
          } else if (file.type.startsWith('audio/')) {
            // Аудио - вызываем аудио загрузчик
            if (callbacks.showAudioUploader) {
              callbacks.showAudioUploader()
              // Эмулируем выбор файла в uploader
              setTimeout(() => {
                const fileInput = document.querySelector('input[type="file"][accept*="audio"]') as HTMLInputElement
                if (fileInput) {
                  const dataTransfer = new DataTransfer()
                  dataTransfer.items.add(file)
                  fileInput.files = dataTransfer.files
                  fileInput.dispatchEvent(new Event('change', { bubbles: true }))
                }
              }, 100)
            }
          }
        }
        input.click()
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
 * Обработчик форматирования врезки (squib)
 * @param action - тип команды форматирования или название класса
 * @returns функция, применяющая форматирование к выбранной врезке
 */
export const handleSquibFormatting = (action: string): ((el: HTMLElement) => boolean) => {
  return (squibElement: HTMLElement): boolean => {
    if (!squibElement) return false

    // Функция для добавления/удаления класса
    const toggleClass = (className: string) => {
      if (squibElement.classList.contains(className)) {
        squibElement.classList.remove(className)
      } else {
        // Для выравнивания сначала удаляем все классы выравнивания
        if (className.startsWith('align-')) {
          squibElement.classList.remove('align-left', 'align-center', 'align-right')
        }
        squibElement.classList.add(className)
      }
      return true
    }

    // Обрабатываем различные типы форматирования
    switch (action) {
      case 'align-left':
        return toggleClass('align-left')
      case 'align-center':
        return toggleClass('align-center')
      case 'align-right':
        return toggleClass('align-right')
      case 'bg-gray':
      case 'bg-white':
      case 'bg-black':
      case 'bg-yellow':
      case 'bg-red':
      case 'bg-green': {
        // Удаляем все классы фона
        squibElement.classList.remove('bg-gray', 'bg-white', 'bg-black', 'bg-yellow', 'bg-red', 'bg-green')
        // Добавляем нужный класс
        return toggleClass(action)
      }
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
      // Установим флаг появления с небольшой задержкой для анимации
      setTimeout(() => setIsAppearing(true), 50)
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

    // Сохраняем текущую селекцию перед открытием меню
    const selection = window.getSelection()
    const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null

    setIsOpen(!isOpen())

    // Восстанавливаем селекцию после небольшой задержки
    if (savedRange) {
      setTimeout(() => {
        const newSelection = window.getSelection()
        if (newSelection) {
          newSelection.removeAllRanges()
          newSelection.addRange(savedRange)
        }
      }, 0)
    }
  }
  const handleMenuItemClick = (action: string) => {
    // Сохраняем селекцию перед выполнением действия
    const selection = window.getSelection()
    const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null

    props.onAction(action === 'horizontal-rule' ? ('hr' as CommandType) : (action as CommandType))
    setIsOpen(false)

    // Восстанавливаем селекцию после выполнения действия
    if (savedRange) {
      setTimeout(() => {
        const newSelection = window.getSelection()
        if (newSelection) {
          newSelection.removeAllRanges()
          newSelection.addRange(savedRange)
        }
      }, 0)
    }

    if (props.onClose) props.onClose()
  }

  // Определяем реальную видимость меню - упрощенная логика как в Notion
  const isReallyVisible = () => {
    return props.isVisible
  }

  // Editor использует ограниченный набор элементов меню
  const editorMenuItems = ['upload', 'embed', 'separator']

  // Отладочная информация
  console.log('[PlusMenu] Render:', {
    isVisible: props.isVisible,
    isReallyVisible: isReallyVisible(),
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
        [styles.visible]: isReallyVisible(),
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
          onMouseDown={(e) => e.preventDefault()} // Предотвращаем потерю фокуса редактора
          title={t('Add a link or click plus to embed media')}
        >
          <Icon name="editor-plus" />
        </button>

        {/* Плейсхолдер - показывается только когда меню закрыто и нет активной формы */}
        <Show when={!isOpen() && !props.isFormActive}>
          <span
            class={styles.placeholder}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              // Клик на плейсхолдер = показать форму ссылки
              props.onAction('link')
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {t('Add a link or click plus to embed media')}
          </span>
        </Show>
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
