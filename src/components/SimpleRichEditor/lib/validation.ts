/**
 * @module validation
 * @description Модуль содержит функции валидации для SimpleRichEditor
 */

import { isEmptyContent } from '~/components/SimpleRichEditor/lib/empty'
import { DraftInput } from '~/graphql/schema/core.gen'
import { cleanupContent } from './sanitize'

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

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

/**
 * Проверяет черновик на готовность к публикации
 * @param draft Черновик для проверки
 * @returns Результат валидации с массивом ошибок
 */
export const validateDraftForPublishing = (draft: DraftInput): ValidationResult => {
  const errors: ValidationError[] = []

  // Проверка заголовка
  if (!draft.title?.trim()) {
    errors.push({
      field: 'title',
      message: 'Title is required'
    })
  }

  // Применяем очистку к содержимому body перед валидацией
  const cleanedBody = draft.body ? cleanupContent(draft.body) : null

  // Проверка body на пустоту после очистки
  if (isEmptyContent(cleanedBody)) {
    // Используем cleanedBody
    errors.push({
      field: 'body',
      message: 'Body cannot be empty'
    })
  } else {
    // Проверка на минимальную длину текста
    const tmpDiv = document.createElement('div')
    tmpDiv.innerHTML = cleanedBody || '' // Используем cleanedBody
    const plainText = tmpDiv.textContent?.trim() || ''
    if (plainText.length < 10) {
      errors.push({
        field: 'body',
        message: 'Body text should be at least 10 characters long'
      })
    }
  }

  // Проверка lead
  if (draft.lead && isEmptyContent(draft.lead)) {
    errors.push({
      field: 'lead',
      message: 'Lead cannot be empty if provided'
    })
  }

  // Проверка тем
  if (!draft.topic_ids?.length) {
    errors.push({
      field: 'topics',
      message: 'At least one topic is required'
    })
  }

  // Проверка главной темы
  if (!draft.main_topic_id && draft.topic_ids?.length) {
    errors.push({
      field: 'main_topic',
      message: 'Main topic is required when topics are present'
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Проверяет черновик на возможность сохранения
 * Менее строгие проверки чем для публикации
 * @param draft Черновик для проверки
 * @returns Результат валидации
 */
export const validateDraftForSaving = (draft: DraftInput): ValidationResult => {
  const errors: ValidationError[] = []

  // Базовые проверки
  if (draft.body && isEmptyContent(draft.body)) {
    errors.push({
      field: 'body',
      message: 'Body cannot be empty if provided'
    })
  }

  if (draft.lead && isEmptyContent(draft.lead)) {
    errors.push({
      field: 'lead',
      message: 'Lead cannot be empty if provided'
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}
