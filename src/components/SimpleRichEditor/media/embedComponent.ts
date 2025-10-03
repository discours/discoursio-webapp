/**
 * @module media/embedComponent
 * @description Компактный формат для embed-ссылок в виде кастомного компонента
 *
 * Цель: Упростить хранение и миграцию embed-контента
 * Формат: <embed-link data-platform="..." data-url="..." data-metadata="..."></embed-link>
 */

import { createUniversalEmbed } from './html'
import { EmbedPlatform } from './types'

/**
 * Интерфейс данных embed компонента
 */
export interface EmbedLinkData {
  platform: EmbedPlatform
  url: string
  metadata?: {
    title?: string
    description?: string
    image?: string
    author?: string
    authorUrl?: string
  }
}

/**
 * Создает компактный embed-link элемент
 * @param data Данные embed
 * @returns HTML строка с embed-link компонентом
 */
export const createEmbedLink = (data: EmbedLinkData): string => {
  const { platform, url, metadata } = data

  const metadataAttr = metadata ? ` data-metadata='${JSON.stringify(metadata)}'` : ''

  return `<embed-link data-platform="${platform}" data-url="${url}"${metadataAttr}></embed-link>`
}

/**
 * Парсит embed-link элемент в данные
 * @param element HTML элемент embed-link
 * @returns Данные embed или null
 */
export const parseEmbedLink = (element: HTMLElement): EmbedLinkData | null => {
  const platform = element.getAttribute('data-platform') as EmbedPlatform
  const url = element.getAttribute('data-url')

  if (!platform || !url) return null

  const metadataStr = element.getAttribute('data-metadata')
  let metadata: EmbedLinkData['metadata'] | undefined

  if (metadataStr) {
    try {
      metadata = JSON.parse(metadataStr)
    } catch (e) {
      console.error('Failed to parse embed metadata:', e)
    }
  }

  return { platform, url, metadata }
}

/**
 * Рендерит embed-link компонент в полный HTML для отображения
 * @param element HTML элемент embed-link
 * @returns Promise с HTML строкой
 */
export const renderEmbedLink = async (element: HTMLElement): Promise<string | null> => {
  const data = parseEmbedLink(element)
  if (!data) return null

  // Используем существующую функцию для генерации полного HTML
  return await createUniversalEmbed(data.url)
}

/**
 * Мигрирует старый verbose HTML в компактный embed-link
 * @param html HTML строка или элемент
 * @returns Компактный embed-link или исходный HTML если не распознан
 */
export const migrateToEmbedLink = (html: string | HTMLElement): string => {
  let element: HTMLElement

  if (typeof html === 'string') {
    const temp = document.createElement('div')
    temp.innerHTML = html
    element = temp.firstElementChild as HTMLElement
    if (!element) return html
  } else {
    element = html
  }

  // Определяем платформу по классу
  const classList = element.classList
  let platform: EmbedPlatform | null = null
  let url: string | null = null

  // Проверяем различные форматы embed
  if (classList.contains('youtube-embed') || classList.contains('video-embed')) {
    platform = 'youtube'
    url = element.getAttribute('data-video-url') || element.querySelector('iframe')?.src || null
  } else if (classList.contains('vimeo-embed')) {
    platform = 'vimeo'
    url = element.getAttribute('data-video-url') || element.querySelector('iframe')?.src || null
  } else if (classList.contains('twitch-embed')) {
    platform = 'twitch'
    url = element.getAttribute('data-embed-url') || null
  } else if (classList.contains('ted-embed')) {
    platform = 'ted'
    url = element.getAttribute('data-embed-url') || null
  } else if (classList.contains('soundcloud-embed')) {
    platform = 'soundcloud'
    url = element.getAttribute('data-embed-url') || null
  } else if (classList.contains('bandcamp-embed')) {
    platform = 'bandcamp'
    url = element.getAttribute('data-embed-url') || null
  } else if (classList.contains('facebook-embed')) {
    platform = 'facebook'
    url = element.getAttribute('data-embed-url') || null
  } else if (classList.contains('x-embed') || classList.contains('twitter-embed')) {
    platform = 'x'
    url = element.getAttribute('data-embed-url') || null
  } else if (classList.contains('instagram-embed')) {
    platform = 'instagram'
    url = element.getAttribute('data-embed-url') || null
  } else if (classList.contains('telegram-embed')) {
    platform = 'telegram'
    url = element.getAttribute('data-embed-url') || null
  } else if (classList.contains('reddit-embed')) {
    platform = 'reddit'
    url = element.getAttribute('data-embed-url') || null
  } else if (classList.contains('tiktok-embed')) {
    platform = 'tiktok'
    url = element.getAttribute('data-embed-url') || null
  } else if (classList.contains('discours-embed')) {
    platform = 'discours'
    url = element.querySelector('a')?.href || null
  }

  // Если не распознали - возвращаем исходный HTML
  if (!platform || !url) {
    return typeof html === 'string' ? html : element.outerHTML
  }

  // Создаем компактный embed-link
  return createEmbedLink({ platform, url })
}

/**
 * Инициализирует обработку всех embed-link элементов на странице
 * Заменяет их на полный HTML при необходимости
 */
export const initEmbedLinks = async (): Promise<void> => {
  const embedLinks = document.querySelectorAll('embed-link')

  for (const element of Array.from(embedLinks)) {
    try {
      const html = await renderEmbedLink(element as HTMLElement)
      if (html) {
        const temp = document.createElement('div')
        temp.innerHTML = html
        const newElement = temp.firstElementChild
        if (newElement) {
          element.replaceWith(newElement)
        }
      }
    } catch (error) {
      console.error('Failed to render embed-link:', error)
    }
  }
}
