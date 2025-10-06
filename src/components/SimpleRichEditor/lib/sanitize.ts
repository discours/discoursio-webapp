import type { Config } from 'dompurify'
import DOMPurify from 'isomorphic-dompurify'

// Список разрешенных доменов для iframe
const ALLOWED_IFRAME_DOMAINS = ['youtube.com', 'youtube-nocookie.com', 'youtu.be', 'vimeo.com', 'player.vimeo.com']

/**
 * Конфигурация разрешенных HTML тегов и атрибутов
 * в соответствии с возможностями редактора
 */
const ALLOWED_TAGS = [
  // Базовая разметка
  'p',
  'br',
  'div',
  // Форматирование текста
  'b',
  'strong',
  'i',
  'em',
  'u',
  'strike',
  // Выделение текста
  'mark',
  'highlight',
  'span',
  // Ссылки и медиа
  'a',
  'img',
  'video',
  'iframe', // Фильтруется дополнительно
  'preview' // Кастомный тег для компактного хранения video embeds
]

const ALLOWED_ATTR = [
  // Ссылки
  'href',
  'target',
  'rel',
  // Изображения
  'src',
  'alt',
  'title',
  // Видео
  'width',
  'height',
  'frameborder',
  'allowfullscreen',
  // Стили и форматирование
  'style',
  'class',
  // Подвёрстка (incut)
  'data-align',
  'data-bg',
  'data-incut-id',
  // Другие data-атрибуты для редактора
  'data-type'
]

// Базовая конфигурация согласно документации DOMPurify
const BASE_CONFIG: Config = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ADD_TAGS: ['iframe', 'preview'], // preview - кастомный тег для компактного хранения video URLs
  ADD_ATTR: ['sandbox', 'loading', 'referrerpolicy', 'data-align', 'data-bg', 'data-incut-id', 'data-type'],
  ALLOW_DATA_ATTR: false, // Запрещаем data-* атрибуты кроме явно разрешенных
  ALLOW_UNKNOWN_PROTOCOLS: false, // Разрешаем только стандартные протоколы
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  SANITIZE_DOM: true,
  USE_PROFILES: { html: true }, // Используем только HTML профиль
  WHOLE_DOCUMENT: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_TRUSTED_TYPE: false // Отключаем Trusted Types для совместимости
}

const NOTAGS_REGEXP = /<\/?[a-z][\s\S]*>/i

// Добавляем хук для обработки iframe
DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
  if (node.tagName.toLowerCase() === 'iframe') {
    const src = node.getAttribute('src')
    if (!src) {
      node.remove()
      return
    }

    try {
      const url = new URL(src)
      if (!ALLOWED_IFRAME_DOMAINS.some((domain) => url.hostname.endsWith(domain))) {
        node.remove()
        return
      }

      // Устанавливаем безопасные атрибуты согласно рекомендациям
      node.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups')
      node.setAttribute('loading', 'lazy')
      node.setAttribute('referrerpolicy', 'no-referrer')
      node.removeAttribute('allow') // Удаляем потенциально опасный атрибут
    } catch {
      node.remove()
    }
  }
})

/**
 * Санитизация HTML контента
 * @param html Исходный HTML
 * @returns Очищенный HTML
 */
export const sanitizeHtml = (html: string): string => {
  console.log('[sanitizeHtml] Input:', { html: html?.substring(0, 100), length: html?.length })

  const result = DOMPurify.sanitize(html, BASE_CONFIG)

  console.log('[sanitizeHtml] Output:', {
    result: String(result)?.substring(0, 100),
    length: String(result)?.length,
    type: typeof result
  })

  return String(result)
}

/**
 * Санитизация HTML для рендера с бекенда
 * Используется при первом рендере контента с сервера
 */
export const sanitizeServerHtml = (html: string): string => {
  return DOMPurify.sanitize(html, BASE_CONFIG)
}

/**
 * Проверка поддержки санитайзера
 */
export const isSanitizationSupported = (): boolean => {
  return DOMPurify.isSupported
}

/**
 * Очищает контент от лишних переносов строк и преобразует пустые параграфы
 * Сохраняет до двух переносов подряд
 * @param content Исходный HTML-контент
 * @returns Очищенный HTML с нормализованными переносами строк
 */
export const cleanupContent = (content: string): string => {
  if (!content) return ''

  // Сначала исправляем незавершенные HTML-теги
  const fixedHtml = fixBrokenHtml(content)

  let result = fixedHtml

  // 1. Заменяем пустые параграфы на параграфы с переносами
  result = result.replace(/<p>\s*<\/p>/gi, '<p><br></p>')

  // 2. Заменяем одиночные <br> на параграфы с переносом для единообразия
  result = result.replace(/<br\s*\/?>/gi, '<p><br></p>')

  // 3. Ограничиваем количество последовательных переносов до двух
  result = result.replace(/(<p><br\s*\/?><\/p>){3,}/gi, '<p><br></p><p><br></p>')

  // 4. Удаляем пустые блочные элементы
  result = result.replace(/<div>\s*<\/div>/gi, '')

  // 5. Удаляем пустые параграфы в начале документа
  result = result.replace(/^(\s*<p><br\s*\/?><\/p>\s*)+/i, '')

  // 6. Оборачиваем текст без тегов в параграф
  if (result && !NOTAGS_REGEXP.test(result)) {
    result = `<p>${result}</p>`
  }

  return result
}
/**
 * Исправляет некорректную HTML-структуру с незавершенными тегами
 * @param html Исходный HTML
 * @returns Исправленный HTML с корректной структурой
 */
export const fixBrokenHtml = (html: string): string => {
  if (!html) return ''

  try {
    // Создаем парсер для работы с HTML
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')

    // Получаем HTML из переработанного DOM
    const result = doc.body?.innerHTML || ''

    // Если результат пустой или сильно отличается от исходного HTML,
    // возвращаем исходный HTML, так как парсер мог удалить слишком много
    if (!result || (result.length < html.length * 0.5 && html.length > 20)) {
      console.warn('[SimpleRichEditor] HTML parser removed too much content, using DOMPurify instead')
      return sanitizeHtml(html)
    }

    return result
  } catch (e) {
    console.error('[SimpleRichEditor] Error fixing broken HTML:', e)
    // В случае ошибки используем DOMPurify для очистки HTML
    return sanitizeHtml(html)
  }
}
