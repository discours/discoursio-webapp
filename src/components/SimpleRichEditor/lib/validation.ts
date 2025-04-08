/**
 * @module validation
 * @description Модуль содержит функции валидации для SimpleRichEditor
 */

/**
 * Регулярное выражение для URL адресов
 */
export const WEB_URL_REGEX = /^(https|http)?:\/\//

/**
 * Регулярное выражение для Vimeo URL
 */
export const VIMEO_URL_REGEX = /^(https?:\/\/)?(www\.)?vimeo\.com\/([0-9]+)/

/**
 * Регулярное выражение для YouTube URL
 */
export const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/

/**
 * Интерфейс для опций инлайн-форм
 */
export interface InlineFormOptions {
  type: string
  onSubmit: (value: string) => void
  validate?: (url: string) => string
}

/**
 * Валидирует URL адрес
 *
 * @param url URL для проверки
 * @param t Функция локализации (опционально)
 * @returns Строка с ошибкой или пустая строка, если валидация прошла успешно
 *
 * @example
 * ```ts
 * const error = validateWebUrl('example.com')
 * if (error) {
 *   console.error(error) // "URL must start with http:// or https://"
 * }
 * ```
 */
export const validateWebUrl = (url: string, t?: (key: string) => string): string => {
  const translate = t || ((key: string) => key)

  if (!url) {
    return translate('URL cannot be empty')
  }

  try {
    // Проверяем, что URL начинается с http:// или https:// с помощью регулярного выражения
    if (!url.match(WEB_URL_REGEX)) {
      return translate('URL must start with http:// or https://')
    }

    // Пробуем создать объект URL для проверки валидности
    new URL(url)
    return ''
  } catch (_e) {
    return translate('Invalid URL format')
  }
}

/**
 * Валидирует URL видео (YouTube или Vimeo)
 *
 * @param url URL для проверки
 * @param t Функция локализации (опционально)
 * @returns Строка с ошибкой или пустая строка, если валидация прошла успешно
 *
 * @example
 * ```ts
 * const error = validateVideoUrl('https://youtube.com/invalid')
 * if (error) {
 *   console.error(error) // "Only YouTube and Vimeo links are supported"
 * }
 * ```
 */
export const validateVideoUrl = (url: string, t?: (key: string) => string): string => {
  const translate = t || ((key: string) => key)

  const urlError = validateWebUrl(url, translate)
  if (urlError) return urlError

  // Проверяем, что URL соответствует YouTube или Vimeo с помощью регулярных выражений
  const isYoutube = YOUTUBE_URL_REGEX.test(url)
  const isVimeo = VIMEO_URL_REGEX.test(url)

  if (!isYoutube && !isVimeo) {
    return translate('Only YouTube and Vimeo links are supported')
  }

  return ''
}

/**
 * Функция валидации формы с использованием опций
 *
 * @param value Значение для валидации
 * @param options Опции формы с функцией валидации
 * @returns Строка с ошибкой или пустая строка, если валидация прошла успешно
 */
export const validateFormInput = (value: string, options: InlineFormOptions | null): string => {
  if (!options || !options.validate) return ''
  return options.validate(value)
}
