/**
 * @module video
 * @description Модуль для работы с видео в редакторе
 */

/**
 * Регулярные выражения для проверки URL видео
 */
export const VIMEO_URL_REGEX = /^(https?:\/\/)?(www\.|player\.)?vimeo\.com\/(?:video\/)?(\d+)$/
export const YOUTUBE_URL_REGEX =
  /^(https?:\/\/)?(www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})$/
/**
 * Типы поддерживаемых видеоплатформ
 */
export type VideoPlatform = 'youtube' | 'vimeo'

/**
 * Валидирует URL видео
 * @param url URL для проверки
 * @returns true если URL валидный и поддерживается
 */
export const validateVideoUrl = (url: string): boolean => {
  if (!url) return false

  // Проверяем поддержку платформы
  return YOUTUBE_URL_REGEX.test(url) || VIMEO_URL_REGEX.test(url)
}

/**
 * Определяет платформу видео по URL
 * @param url URL видео
 * @returns Тип платформы или null если не поддерживается
 */
export const detectVideoPlatform = (url: string): VideoPlatform | null => {
  if (YOUTUBE_URL_REGEX.test(url)) {
    return 'youtube'
  }

  if (VIMEO_URL_REGEX.test(url)) {
    return 'vimeo'
  }

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

  // Правильно инициализируем переменную с типом
  let match: RegExpMatchArray | null = null

  if (platform === 'youtube') {
    match = url.match(YOUTUBE_URL_REGEX)
    // Используем optional chaining
    if (match?.[3]) {
      return match[3]
    }
  } else if (platform === 'vimeo') {
    match = url.match(VIMEO_URL_REGEX)
    // Используем optional chaining
    if (match?.[3]) {
      return match[3]
    }
  }

  return null
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
 * Вставляет видео в редактор
 * @param url URL видео
 * @param editor Элемент редактора
 * @returns true если вставка успешна
 */
export const insertVideo = (url: string, editor: HTMLElement): boolean => {
  if (!editor || !url) return false

  const embedHtml = createVideoEmbed(url)
  if (!embedHtml) return false

  // Вставляем в текущую позицию курсора
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return false

  const range = selection.getRangeAt(0)

  // Проверяем, что курсор внутри редактора
  if (!editor.contains(range.commonAncestorContainer)) return false

  // Создаем div с видео
  const temp = document.createElement('div')
  temp.innerHTML = embedHtml

  // Очищаем выделение и вставляем видео
  range.deleteContents()

  // Вставляем фрагмент
  const fragment = document.createDocumentFragment()
  while (temp.firstChild) {
    fragment.appendChild(temp.firstChild)
  }

  range.insertNode(fragment)

  // Перемещаем курсор после видео
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)

  return true
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
