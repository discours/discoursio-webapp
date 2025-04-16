import { clsx } from 'clsx'
import { Component, For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { replaceSelection } from '../lib/empty'
import { CommandType } from '../lib/types'
import { ToolbarControl } from './SimpleToolbar'

import styles from './PlusMenu.module.scss'
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
    showLinkForm?: (onSubmit: (url: string) => void) => void
    showVideoForm?: (onSubmit: (url: string) => void) => void
    showAudioUploader?: () => void
    showImageUploadModal?: () => void
    handleChange?: () => void
  }
): void => {
  switch (action) {
    case 'video':
      if (callbacks.showVideoForm) {
        callbacks.showVideoForm((url: string) => {
          if (url) {
            const videoHtml = `<div class="video-embed"><iframe src="${url}" frameborder="0" allowfullscreen></iframe></div>`
            replaceSelection(videoHtml, editor)
            if (callbacks.handleChange) callbacks.handleChange()
          }
        })
      }
      break
    case 'link':
      if (callbacks.showLinkForm) {
        callbacks.showLinkForm((url: string) => {
          if (url) {
            const selection = window.getSelection()
            let text = selection?.toString() || url
            // Если текст пустой или содержит только пробелы, используем URL
            if (text.trim() === '') text = url
            const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`
            replaceSelection(linkHtml, editor)
            if (callbacks.handleChange) callbacks.handleChange()
          }
        })
      }
      break
    case 'audio':
      if (callbacks.showAudioUploader) {
        callbacks.showAudioUploader()
      }
      break
    case 'image':
      if (callbacks.showImageUploadModal) {
        callbacks.showImageUploadModal()
      }
      break
    case 'hr': {
      replaceSelection('<hr />', editor)
      if (callbacks.handleChange) callbacks.handleChange()
      break
    }
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
 * Плавающее меню вставки контента
 *
 * Особенности:
 * - Кнопка "+" находится слева от редактора на уровне курсора
 * - Плейсхолдер показывается, когда курсор на пустой строке
 * - Подменю появляется рядом с кнопкой плюс
 * - Поддержка вставки ссылок/видео/изображений/аудио/горизонтальной линии
 * - Закрытие по клику вне
 * - Плавные анимации
 * - Оперативное обновление положения по вертикали в зависимости от положения курсора
 */
export const PlusMenu: Component<{
  position: { top: number; left: number; isVisible?: boolean }
  isVisible: boolean
  onEmpty?: boolean
  onClose?: () => void
  onAction: (action: CommandType) => void
  editorId?: string
}> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false)
  const [menuRef, setMenuRef] = createSignal<HTMLDivElement>()
  const [isAppearing, setIsAppearing] = createSignal(false)
  const [currentPosition, setCurrentPosition] = createSignal<{ top: number; left: number }>({
    top: props.position.top,
    left: props.position.left
  })

  // Эффект плавного появления меню
  createEffect(() => {
    if (props.isVisible && props.position.isVisible !== false) {
      // Установим флаг появления с небольшой задержкой для анимации
      setTimeout(() => setIsAppearing(true), 50)
    } else {
      setIsAppearing(false)
    }
  })

  // Эффект для обновления позиции при изменении props.position
  createEffect(() => {
    if (props.position && props.position.isVisible !== false) {
      // Обновляем координаты с сохранением левой позиции из начальных настроек
      setCurrentPosition((prev) => ({
        top: props.position.top,
        left: prev.left || props.position.left
      }))
    }
  })

  // Следим за положением курсора в родительском компоненте и обновляем позицию меню
  createEffect(() => {
    if (!props.editorId || !props.isVisible) return

    const trackCursorPosition = () => {
      const editor = document.querySelector(`[data-editor-id="${props.editorId}"]`) as HTMLElement
      if (!editor) return

      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)

      // Проверяем, что курсор находится в редакторе
      if (editor.contains(range.commonAncestorContainer)) {
        const rangeRect = range.getBoundingClientRect()

        // Получаем текущую позицию скролла
        const scrollTop = window.scrollY || document.documentElement.scrollTop
        const scrollLeft = window.scrollX || document.documentElement.scrollLeft

        // Если у нас пустая строка и высота rangeRect равна 0,
        // получаем координаты родительского элемента (параграфа или блока)
        if (rangeRect.height === 0) {
          const container = range.startContainer
          let currentNode = container

          // Поднимаемся до родительского блочного элемента
          while (currentNode && currentNode.nodeType === Node.TEXT_NODE) {
            currentNode = currentNode.parentNode as Node
          }

          if (currentNode && currentNode instanceof Element) {
            const blockRect = currentNode.getBoundingClientRect()

            // Устанавливаем позицию на уровне блока
            setCurrentPosition({
              top: blockRect.top + scrollTop + blockRect.height / 2 - 10,
              left: blockRect.left + scrollLeft - 30,
              isVisible: true
            })
            return
          }
        }

        // Стандартное позиционирование для обычного текста
        setCurrentPosition({
          top: rangeRect.top + scrollTop + rangeRect.height / 2 - 10,
          left: rangeRect.left + scrollLeft - 30,
          isVisible: true
        })
      }
    }

    // Активное отслеживание изменений положения курсора
    document.addEventListener('selectionchange', trackCursorPosition)
    document.addEventListener('keyup', trackCursorPosition)
    document.addEventListener('click', trackCursorPosition)
    document.addEventListener('mouseup', trackCursorPosition)

    // Добавляем отслеживание скролла
    document.addEventListener('scroll', trackCursorPosition, { passive: true })

    // Запускаем обновление позиции при монтировании
    requestAnimationFrame(trackCursorPosition)

    // Создаем интервал для периодического обновления позиции
    // Это гарантирует актуальность положения меню
    const intervalId = setInterval(trackCursorPosition, 200)

    return () => {
      document.removeEventListener('selectionchange', trackCursorPosition)
      document.removeEventListener('keyup', trackCursorPosition)
      document.removeEventListener('click', trackCursorPosition)
      document.removeEventListener('mouseup', trackCursorPosition)
      document.removeEventListener('scroll', trackCursorPosition)
      clearInterval(intervalId)
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
    setIsOpen(!isOpen())
  }

  const handleMenuItemClick = (action: string) => {
    props.onAction(action === 'horizontal-rule' ? ('hr' as CommandType) : (action as CommandType))
    setIsOpen(false)
    if (props.onClose) props.onClose()
  }

  // Обработчик клика по плейсхолдеру - должен установить фокус на редактор
  const handlePlaceholderClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Находим редактор по идентификатору, если он указан
    let editor: HTMLElement | null = null

    if (props.editorId) {
      // Ищем редактор с конкретным id
      editor = document.querySelector(`[data-editor-id="${props.editorId}"]`) as HTMLElement
    } else {
      // Находим ближайший редактор
      editor = (e.target as HTMLElement).closest('.SimpleRichEditor_editor__content') as HTMLElement
    }

    // Устанавливаем фокус на редактор
    if (editor) {
      editor.focus()
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

  // Определяем реальную видимость меню по обоим параметрам: isVisible и position.isVisible
  const isReallyVisible = () => props.isVisible && props.position.isVisible !== false

  // Показываем плейсхолдер только если меню видимо, не открыто подменю и курсор на пустой строке
  const shouldShowPlaceholder = () => isReallyVisible() && !isOpen() && props.onEmpty === true

  // Дополняем логику меню - оно должно отображаться всегда, когда курсор на пустой строке
  // или когда курсор на конце непустой строки (для вставки после текста)
  const getMenuPosition = () => {
    return {
      ...currentPosition(),
      // Если курсор на пустой строке, показываем меню чуть выше для лучшей видимости
      top: props.onEmpty ? currentPosition().top - 5 : currentPosition().top
    }
  }

  // Используем currentPosition для стиля меню и применяем необходимые трансформации
  const menuStyle = {
    top: `${getMenuPosition().top}px`,
    left: `${currentPosition().left}px`,
    transform: 'translate(0, 0)', // Гарантируем, что transform не будет переопределен
    position: 'fixed' as const // Явно указываем позицию fixed для предотвращения конфликтов
  }

  return (
    <div
      ref={setMenuRef}
      class={clsx(styles.plusMenu, {
        [styles.visible]: isReallyVisible(),
        [styles.appearing]: isAppearing()
      })}
      style={menuStyle}
      data-editor-id={props.editorId}
      data-position={JSON.stringify(currentPosition())}
    >
      <div class={styles.plusMenuWrapper}>
        <button
          class={clsx(styles.plusButton, { [styles.active]: isOpen() })}
          onClick={handlePlusClick}
          title="Добавить контент"
        >
          <Icon name="editor-plus" />
        </button>
      </div>

      <Show when={shouldShowPlaceholder()}>
        <div class={styles.placeholder} onClick={handlePlaceholderClick}>
          Добавьте ссылку или нажмите плюс для вставки медиа
        </div>
      </Show>

      <Show when={isOpen()}>
        <div class={clsx(styles.menuItems, 'visible')} onClick={(e) => e.stopPropagation()}>
          <For each={['link', 'image', 'video', 'audio', 'horizontal-rule']}>
            {(action) => (
              <ToolbarControl
                action={action === 'horizontal-rule' ? ('hr' as CommandType) : (action as CommandType)}
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
