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
 * Получает keywords для страницы на основе контента и пути
 */
// biome-ignore lint/suspicious/noExplicitAny: ok
export function getPageKeywords(contentInfo: any, pathname: string, locale: 'ru' | 'en'): string {
  // Определяем тип контента и подбираем подходящие keywords
  if (contentInfo.type === 'topic' && contentInfo.data?.title) {
    return getTopicKeywords(locale, contentInfo.data.title)
  }

  // Определяем ключ на основе pathname
  if (pathname === '/' || pathname === '') return getKeywords(locale, 'home')
  if (pathname.includes('/dogma')) return getKeywords(locale, 'dogma')
  if (pathname.includes('/guide')) return getKeywords(locale, 'guide')
  if (pathname.includes('/principles')) return getKeywords(locale, 'principles')
  if (pathname.includes('/terms-of-use')) return getKeywords(locale, 'terms-of-use')

  // По умолчанию используем home keywords
  return getKeywords(locale, 'home')
}
