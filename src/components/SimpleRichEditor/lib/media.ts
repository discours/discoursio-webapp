/**
 * @module media
 * @description Единый модуль для работы с медиа-контентом в редакторе
 */

import { Accessor, Setter } from 'solid-js'
import { MediaItem } from '~/graphql/generated/graphql'
import { EditorFieldType, Position } from './types'
import { getOrCreateSelection, replaceSelection } from './utils'

/**
 * Типы поддерживаемых медиа
 */
export type MediaType = 'image' | 'video' | 'audio'

/**
 * Типы поддерживаемых видеоплатформ
 */
export type VideoPlatform = 'youtube' | 'vimeo'

/**
 * Интерфейс для параметров вставки медиа
 */
export interface InsertMediaParams {
  type: MediaType
  url: string
  title?: string
  attributes?: Record<string, string>
}

/**
 * Контекст для медиа-обработчиков
 */
export interface MediaHandlersContext {
  editorRef: Accessor<HTMLDivElement | undefined>
  props: {
    readOnly?: boolean
    fieldType?: EditorFieldType
  }
  // State setters
  setEditingImage: Setter<HTMLElement | null>
  setCurrentSquib: Setter<HTMLElement | null>
  setShowSquibEditor: Setter<boolean>
  // Form handlers
  showInlineForm: (type: 'link' | 'video', onSubmit: (value: string) => void, initialValue?: string) => void
  showImageUploadModal: () => void
  handleInsertLink: (url: string) => void
  // Utility functions
  saveSelection: () => void
}

// ===== URL VALIDATION =====

/**
 * Регулярные выражения для проверки URL видео
 */
export const VIMEO_URL_REGEX = /^(https?:\/\/)?(www\.|player\.)?vimeo\.com\/(?:video\/)?(\d+)$/
export const YOUTUBE_URL_REGEX =
  /^(https?:\/\/)?(www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})$/

/**
 * Валидирует URL
 * @param url URL для проверки
 * @returns true если URL валиден
 */
export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    return ['http:', 'https:'].includes(urlObj.protocol)
  } catch (_e) {
    return false
  }
}

/**
 * Валидирует URL видео
 * @param url URL для проверки
 * @returns true если URL валидный и поддерживается
 */
export const validateVideoUrl = (url: string): boolean => {
  if (!url) return false
  return YOUTUBE_URL_REGEX.test(url) || VIMEO_URL_REGEX.test(url)
}

/**
 * Определяет платформу видео по URL
 * @param url URL видео
 * @returns Тип платформы или null если не поддерживается
 */
export const detectVideoPlatform = (url: string): VideoPlatform | null => {
  if (YOUTUBE_URL_REGEX.test(url)) return 'youtube'
  if (VIMEO_URL_REGEX.test(url)) return 'vimeo'
  return null
}

/**
 * Извлекает ID видео из URL
 * @param url URL видео
 * @returns ID видео или null если не удалось извлечь
 */
export const extractVideoId = (url: string): string | null => {
  const platform = detectVideoPlatform(url)
  if (!platform) return null

  let match: RegExpMatchArray | null = null

  if (platform === 'youtube') {
    match = url.match(YOUTUBE_URL_REGEX)
    if (match?.[3]) return match[3]
  } else if (platform === 'vimeo') {
    match = url.match(VIMEO_URL_REGEX)
    if (match?.[3]) return match[3]
  }

  return null
}

// ===== HTML CREATION =====

/**
 * Создает HTML разметку для аудио-плеера
 * @param url URL аудио-файла
 * @returns HTML строка для аудио-элемента
 */
export const createAudioHTML = (url: string): string => {
  return `<div class="audio-embed" data-audio-src="${url}">
    <audio src="${url}" controls></audio>
  </div>`
}

/**
 * Создает HTML-код для встраивания видео
 * @param url URL видео
 * @returns HTML-код или null если не удалось создать
 */
export const createVideoEmbed = (url: string): string | null => {
  const platform = detectVideoPlatform(url)
  const videoId = extractVideoId(url)

  if (!platform || !videoId) return null

  // Создаем обертку для iframe
  const wrapper = document.createElement('div')
  wrapper.className = 'video-embed'
  wrapper.style.position = 'relative'
  wrapper.style.paddingBottom = '56.25%' // 16:9 соотношение сторон
  wrapper.style.height = '0'
  wrapper.style.overflow = 'hidden'
  wrapper.style.maxWidth = '100%'

  // Создаем iframe
  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.top = '0'
  iframe.style.left = '0'
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  iframe.setAttribute('frameborder', '0')
  iframe.setAttribute('allowfullscreen', 'true')

  // Устанавливаем URL в зависимости от платформы
  if (platform === 'youtube') {
    iframe.src = `https://www.youtube.com/embed/${videoId}`
  } else if (platform === 'vimeo') {
    iframe.src = `https://player.vimeo.com/video/${videoId}`
  }

  wrapper.appendChild(iframe)
  return wrapper.outerHTML
}

/**
 * Создает HTML для вставки медиа в редактор
 * @param params Параметры медиа
 * @returns HTML строка для вставки
 */
export const createMediaHTML = (params: InsertMediaParams): string => {
  const { type, url, title = '', attributes = {} } = params

  // Собираем строку атрибутов
  const attributesStr = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')

  switch (type) {
    case 'image':
      return `<img src="${url}" alt="${title}" ${attributesStr} />`
    case 'video': {
      // Для видео используем embed если это поддерживаемая платформа
      const embedHtml = createVideoEmbed(url)
      if (embedHtml) return embedHtml
      // Иначе обычный video тег
      return `<video src="${url}" controls title="${title}" ${attributesStr}></video>`
    }
    case 'audio':
      return createAudioHTML(url)
    default:
      return ''
  }
}

// ===== INSERTION FUNCTIONS =====

/**
 * Вставляет медиа в редактор
 * @param params Параметры медиа
 * @param editor Редактор для вставки
 * @returns true если вставка успешна
 */
export const insertMedia = (params: InsertMediaParams, editor: HTMLElement | null): boolean => {
  if (!editor || !params.url) return false

  const mediaHtml = createMediaHTML(params)
  if (!mediaHtml) return false

  return replaceSelection(mediaHtml, editor)
}

/**
 * Вставляет аудио в редактор
 * @param url URL аудио-файла
 * @param editor Редактор для вставки
 * @returns true если вставка успешна
 */
export const insertAudio = (url: string, editor: HTMLElement | null): boolean => {
  return insertMedia({ type: 'audio', url }, editor)
}

/**
 * Вставляет видео в редактор
 * @param url URL видео
 * @param editor Элемент редактора
 * @returns true если вставка успешна
 */
export const insertVideo = (url: string, editor: HTMLElement | null): boolean => {
  if (!validateVideoUrl(url)) return false
  return insertMedia({ type: 'video', url }, editor)
}

/**
 * Вставляет изображение в редактор
 * @param url URL изображения
 * @param editor Элемент редактора
 * @param alt Альтернативный текст
 * @returns true если вставка успешна
 */
export const insertImage = (url: string, editor: HTMLElement | null, alt?: string): boolean => {
  return insertMedia({ type: 'image', url, title: alt }, editor)
}

// ===== UPLOAD HANDLERS =====

/**
 * Обрабатывает вставку аудио из загрузчика
 * @param audioItems Загруженные аудио элементы
 * @param editor Редактор
 * @returns true если вставка успешна
 */
export const handleAudioUploaderResult = (audioItems: MediaItem[], editor: HTMLElement | null): boolean => {
  if (!editor || !audioItems.length) return false

  let success = true
  audioItems.forEach((audio) => {
    if (audio.url) {
      const result = insertAudio(audio.url, editor)
      if (!result) success = false
    }
  })

  return success
}

// ===== MEDIA UTILITIES =====

/**
 * Получает все медиа элементы из редактора
 * @param editor Элемент редактора
 * @returns Массив медиа элементов
 */
export const getMediaElements = (editor: HTMLElement | null): HTMLElement[] => {
  if (!editor) return []
  return Array.from(editor.querySelectorAll('img, video, audio, iframe'))
}

/**
 * Обновляет существующее видео
 * @param videoElement Элемент видео
 * @param url Новый URL видео
 * @returns true если обновление успешно
 */
export const updateVideo = (videoElement: HTMLElement, url: string): boolean => {
  if (!videoElement || !url) return false

  const iframe = videoElement.querySelector('iframe')
  if (!iframe) return false

  const videoId = extractVideoId(url)
  const platform = detectVideoPlatform(url)

  if (!videoId || !platform) return false

  // Обновляем src iframe
  if (platform === 'youtube') {
    iframe.src = `https://www.youtube.com/embed/${videoId}`
  } else if (platform === 'vimeo') {
    iframe.src = `https://player.vimeo.com/video/${videoId}`
  }

  return true
}

// ===== CLICK HANDLERS =====

/**
 * Creates media click handlers for the editor
 */
export const createMediaHandlers = (context: MediaHandlersContext) => {
  const {
    editorRef,
    props,
    setEditingImage,
    setCurrentSquib,
    setShowSquibEditor,
    showInlineForm,
    showImageUploadModal,
    handleInsertLink,
    saveSelection
  } = context

  const handleContentClick = (e: MouseEvent) => {
    if (!editorRef() || props.readOnly) return
    const target = e.target as HTMLElement

    // Обработка клика по ссылке
    if (target.tagName === 'A' || target.closest('a')) {
      e.preventDefault()
      const link = target.tagName === 'A' ? target : target.closest('a')

      // Для обычных ссылок - показываем форму редактирования
      const href = link?.getAttribute('href') || ''

      // Выделяем ссылку для правильного редактирования
      if (link) {
        const ed = editorRef()
        if (ed) {
          const selectionData = getOrCreateSelection(ed)
          if (selectionData) {
            const { selection } = selectionData
            const range = document.createRange()
            range.selectNodeContents(link)
            selection.removeAllRanges()
            selection.addRange(range)
            saveSelection()
          }
        }
      }

      // Показываем форму с текущим URL ссылки
      showInlineForm('link', handleInsertLink, href)
      return
    }

    // Обработка клика по изображению
    if (target.tagName === 'IMG') {
      e.preventDefault()
      setEditingImage(target)
      showImageUploadModal()
      return
    }

    // Обработка клика по врезке (squib)
    if (target.closest('[data-type="squib"]')) {
      e.preventDefault()
      const squib = target.closest('[data-type="squib"]')
      if (squib) {
        setCurrentSquib(squib as HTMLElement)
        setShowSquibEditor(true)
      }
      return
    }
  }

  return {
    handleContentClick
  }
}

// ===== SQUIB UTILITIES =====

/**
 * Получает все врезки из редактора
 * @param editor Элемент редактора
 * @returns Массив врезок с их идентификаторами и содержимым
 */
export const getAllSquibs = (editor: HTMLElement): Array<{ id: string; content: string; element: HTMLElement }> => {
  if (!editor) return []

  const squibElements = editor.querySelectorAll('[data-type="squib"]')
  if (!squibElements.length) return []

  const squibs = Array.from(squibElements).map((squib) => {
    const squibId = squib.getAttribute('data-squib-id')
    if (!squibId) return null

    return {
      id: squibId,
      content: squib.innerHTML,
      element: squib as HTMLElement
    }
  })

  return squibs.filter(Boolean) as Array<{ id: string; content: string; element: HTMLElement }>
}

/**
 * Находит конкретную врезку по идентификатору
 * @param editor Элемент редактора
 * @param squibId Идентификатор врезки
 * @returns Данные врезки или null, если не найдена
 */
export const getSquibById = (
  editor: HTMLElement,
  squibId: string
): { id: string; content: string; element: HTMLElement } | null => {
  if (!editor || !squibId) return null

  const squibElement = editor.querySelector(`[data-squib-id="${squibId}"]`)
  if (!squibElement) return null

  return {
    id: squibId,
    content: squibElement.innerHTML,
    element: squibElement as HTMLElement
  }
}

/**
 * Удаляет врезку из редактора
 * @param editor Элемент редактора
 * @param squibId ID врезки
 * @returns true если удаление успешно
 */
export const removeSquib = (editor: HTMLElement, squibId: string): boolean => {
  if (!editor || !squibId) return false

  const squibElement = editor.querySelector(`[data-squib-id="${squibId}"]`)
  if (!squibElement) return false

  squibElement.remove()
  return true
}

// ===== POSITIONING UTILITIES =====

/**
 * Варианты типов меню для позиционирования
 */
export type MenuType = 'toolbar' | 'float' | 'plus' | 'form'

/**
 * Варианты расположения меню
 */
export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center'

/**
 * Параметры позиционирования меню
 */
export interface PositionOptions {
  type: MenuType
  placement?: Placement
  offset?: number
  centerHorizontally?: boolean
}

/**
 * Определяет тип устройства
 */
export const isTouchDevice = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * Получает позицию для тулбара
 * @param editor Элемент редактора
 * @param options Параметры позиционирования
 * @returns Позиция тулбара
 */
export const getEditorPosition = (
  editor: HTMLElement | null,
  options: {
    type: 'float' | 'plus'
    placement?: 'top' | 'bottom' | 'left' | 'right'
    offset?: number
    centerHorizontally?: boolean
  }
): Position => {
  if (!editor) return { top: 0, left: 0 }

  const { type, offset = 0 } = options
  const selection = window.getSelection()

  // Для плавающего тулбара при выделении текста
  if (type === 'float' && selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    return {
      top: Math.max(10, rect.top - 40), // Минимум 10px от верха
      left: rect.left + rect.width / 2 // Центрируем над выделением
    }
  }

  // Для plus menu или запасной вариант
  if (editor) {
    const rect = editor.getBoundingClientRect()
    return {
      top: rect.top + offset,
      left: rect.left + (options.centerHorizontally ? rect.width / 2 : 20)
    }
  }

  return { top: 0, left: 0 }
}

// Уникальный идентификатор редактора врезки
export const squibId = 'squib-editor'
