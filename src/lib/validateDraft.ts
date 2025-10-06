/**
 * @module validation
 * @description Модуль содержит функции валидации для SimpleRichEditor
 */

import { VIMEO_URL_REGEX, WEB_URL_REGEX, YOUTUBE_URL_REGEX } from '~/components/SimpleRichEditor/lib/types'
import { DraftInput } from '~/graphql/generated/graphql'
import { parseJsonContent } from '../components/SimpleRichEditor/lib/storage'

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
 * Тип ошибки валидации
 * @property field - Поле, содержащее ошибку
 * @property message - Сообщение об ошибке
 */
export type ValidationError = {
  field: keyof DraftInput | null
  message: string
}

/**
 * Результат валидации черновика
 * @property isValid - Флаг, указывающий на валидность черновика
 * @property errors - Массив ошибок валидации
 */
export type ValidationResult = {
  isValid: boolean
  errors: ValidationError[]
}

/**
 * Очищает HTML от кавычек и JSON-обертки
 * @param content строка для очистки
 * @returns очищенная строка
 */
const cleanupHtmlContent = (content: string | null | undefined): string => {
  if (!content) return ''

  let cleanContent = content

  // Если значение содержит кавычки в начале и в конце
  if (cleanContent?.startsWith('"') && cleanContent?.endsWith('"')) {
    try {
      // Пробуем распарсить как JSON-строку
      const parsed = JSON.parse(cleanContent)
      if (typeof parsed === 'string') {
        cleanContent = parsed
      }
    } catch (e) {
      console.debug('[validateDraft] Could not parse content as JSON, using as is:', e)
      // Если не смогли распарсить, просто убираем внешние кавычки
      cleanContent = cleanContent.substring(1, cleanContent.length - 1)
    }
  }

  // Используем parseJsonContent для очистки JSON-обертки, если она есть
  let parsedSuccessfully = false
  let potentialStringContent = cleanContent
  try {
    const parsed = parseJsonContent(cleanContent)
    // Убедимся, что результат парсинга - строка
    if (typeof parsed === 'string') {
      potentialStringContent = parsed
      parsedSuccessfully = true
    } else {
      console.debug('[validateDraft] Parsed content is not a string, keeping original.')
    }
  } catch (e) {
    // Если не удалось распарсить как JSON, оставляем как есть
    console.debug('[validateDraft] Could not parse content as JSON, using as is:', e)
  }
  // Обновляем cleanContent только если парсинг был успешен и вернул строку
  if (parsedSuccessfully) {
    cleanContent = potentialStringContent
  }

  // Дополнительная очистка от экранированных кавычек
  // Убедимся, что cleanContent все еще строка перед вызовом replace
  if (typeof cleanContent === 'string') {
    cleanContent = cleanContent.replace(/\\\\"/g, '"')
  } else {
    // Если cleanContent не строка после всех попыток, вернем пустую строку или исходное значение?
    // Вернем пустую строку, так как функция должна возвращать string
    console.warn(
      '[validateDraft] cleanContent ended up as non-string, returning empty string. Original content:',
      content
    )
    return ''
  }

  return cleanContent
}

/**
 * Проверяет черновик на готовность к публикации
 * @param draft черновик для проверки
 * @param isForPublishing если true, проверяет все поля для публикации; если false, только базовые поля для черновика
 * @returns результат валидации
 */
export const validateDraftForPublishing = (draft: DraftInput, isForPublishing = false): ValidationResult => {
  const errors: ValidationError[] = []

  // Проверка заголовка (только для публикации)
  if (isForPublishing && (!draft.title || draft.title.trim() === '')) {
    errors.push({
      field: 'title',
      message: 'Title is required'
    })
  }

  // Проверка текста (только для публикации)
  if (isForPublishing) {
    const bodyContent = cleanupHtmlContent(draft.body)
    if (!bodyContent || bodyContent.trim() === '' || bodyContent === '<br>') {
      errors.push({
        field: 'body',
        message: 'Content is required'
      })
    }
  }

  // Проверка темы (только для публикации)
  if (isForPublishing && (!draft.topic_ids || !draft.topic_ids.length)) {
    errors.push({
      field: 'topic_ids',
      message: 'At least one topic is required'
    })
  }

  // Проверка слага (только для публикации)
  if (isForPublishing && (!draft.slug || draft.slug.trim() === '')) {
    errors.push({
      field: 'slug',
      message: 'URL is required'
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}
