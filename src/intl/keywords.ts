import enKeywords from '~/intl/locales/en/keywords.json'
import ruKeywords from '~/intl/locales/ru/keywords.json'

/**
 * Получает keywords для указанного языка и ключа
 */
export function getKeywords(locale: 'ru' | 'en', key = 'home'): string {
  const keywords = locale === 'ru' ? ruKeywords : enKeywords
  return keywords[key as keyof typeof keywords] || keywords.home || ''
}

/**
 * Получает keywords для домашней страницы
 */
export function getHomeKeywords(locale: 'ru' | 'en'): string {
  return getKeywords(locale, 'home')
}

/**
 * Получает keywords для топика с подстановкой названия
 */
export function getTopicKeywords(locale: 'ru' | 'en', topicName: string): string {
  const template = getKeywords(locale, 'topic')
  return template.replace('{topic}', topicName)
}

/**
 * Получает keywords для статьи с подстановкой заголовка и тем
 */
// biome-ignore lint/suspicious/noExplicitAny: ok
export function getArticleKeywords(locale: 'ru' | 'en', article: any): string {
  const baseKeywords = getKeywords(locale, 'article')
  let keywords = baseKeywords

  // Добавляем заголовок статьи
  if (article.title) {
    keywords = `${article.title}, ${keywords}`
  }

  // Добавляем темы статьи
  if (article.topics?.length > 0) {
    const topicNames = article.topics.map((topic: { title: string }) => topic.title).join(', ')
    keywords = `${topicNames}, ${keywords}`
  }

  return keywords
}

/**
 * Получает keywords для автора с подстановкой имени
 */
// biome-ignore lint/suspicious/noExplicitAny: ok
export function getAuthorKeywords(locale: 'ru' | 'en', author: any): string {
  const baseKeywords = getKeywords(locale, 'author')

  if (author.name) {
    return `${author.name}, ${baseKeywords}`
  }

  return baseKeywords
}

/**
 * Получает keywords для страницы на основе контента и пути
 */
// biome-ignore lint/suspicious/noExplicitAny: ok
export function getPageKeywords(contentInfo: any, pathname: string, locale: 'ru' | 'en'): string {
  // Определяем тип контента и подбираем подходящие keywords
  if (contentInfo.type === 'article' && contentInfo.data) {
    return getArticleKeywords(locale, contentInfo.data)
  }

  if (contentInfo.type === 'author' && contentInfo.data) {
    return getAuthorKeywords(locale, contentInfo.data)
  }

  if (contentInfo.type === 'topic' && contentInfo.data?.title) {
    return getTopicKeywords(locale, contentInfo.data.title)
  }

  // Определяем ключ на основе pathname
  const segments = pathname.split('/').filter(Boolean)
  const firstSegment = segments[0] || 'home'

  // Маршруты первого уровня
  if (pathname === '/' || pathname === '') return getKeywords(locale, 'home')
  if (firstSegment === 'feed') return getKeywords(locale, 'feed')
  if (firstSegment === 'authors') return getKeywords(locale, 'authors')
  if (firstSegment === 'topics') return getKeywords(locale, 'topics')
  if (firstSegment === 'search') return getKeywords(locale, 'search')
  if (firstSegment === 'edit') return getKeywords(locale, 'edit')
  if (firstSegment === 'inbox') return getKeywords(locale, 'inbox')
  if (firstSegment === 'settings') return getKeywords(locale, 'settings')

  // Статические страницы
  if (pathname.includes('/dogma')) return getKeywords(locale, 'dogma')
  if (pathname.includes('/guide')) return getKeywords(locale, 'guide')
  if (pathname.includes('/principles')) return getKeywords(locale, 'principles')
  if (pathname.includes('/terms-of-use') || pathname.includes('/terms')) return getKeywords(locale, 'terms')
  if (pathname.includes('/connect')) return getKeywords(locale, 'connect')
  if (pathname.includes('/debate')) return getKeywords(locale, 'debate')
  if (pathname.includes('/manifest')) return getKeywords(locale, 'manifest')
  if (pathname.includes('/partners')) return getKeywords(locale, 'partners')
  if (pathname.includes('/support')) return getKeywords(locale, 'support')
  if (pathname.includes('/thanks')) return getKeywords(locale, 'thanks')

  // По умолчанию используем home keywords
  return getKeywords(locale, 'home')
}
