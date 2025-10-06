/**
 * @module lib/media/html
 * @description Генерация HTML для различных типов медиа-контента
 */

import { createMetadataPreview, type EmbedMetadata, getEmbedMetadata, OEMBED_ENDPOINTS } from './previewMetadata'
import styles from './styles.module.scss'
import { EmbedContent, MediaInsertParams } from './types'
import { detectEmbedPlatform, detectVideoPlatform } from './validation'

/**
 * Создает HTML элемент с заданными атрибутами
 * @param tag Тег элемента
 * @param attrs Атрибуты элемента
 * @param content Текстовое содержимое
 * @returns HTML элемент
 */
const createElement = (tag: string, attrs: Record<string, string> = {}, content?: string): HTMLElement => {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value)
  }
  if (content) el.textContent = content
  return el
}

/**
 * Создает HTML-код для встраивания видео используя компактный кастомный тег
 * @param url URL видео
 * @returns HTML-код или null если не удалось создать
 */
export const createVideoEmbed = (url: string): string | null => {
  const platform = detectVideoPlatform(url)
  if (!platform) return null

  // Компактный формат - кастомный тег <preview>url</preview>
  // Используем кастомный тег, т.к. <embed> - void element без textContent
  // <preview> семантически точно описывает назначение - placeholder для iframe
  return `<preview>${url}</preview>`
}

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
 * Создает HTML разметку для встраивания изображения
 * @param content Параметры изображения
 * @returns HTML строка
 */
export const createImageEmbed = (content: EmbedContent): string => {
  const figure = createElement('figure')
  const img = createElement('img', {
    src: content.url,
    alt: content.title || '',
    ...(content.width ? { width: content.width.toString() } : {}),
    ...(content.height ? { height: content.height.toString() } : {})
  })
  figure.appendChild(img)
  if (content.title) {
    const caption = createElement('figcaption', {}, content.title)
    figure.appendChild(caption)
  }
  return figure.outerHTML
}

/**
 * Создает HTML разметку для встраивания ссылки с превью
 * @param content Параметры ссылки
 * @returns HTML строка
 */
export const createLinkPreview = (content: EmbedContent): string => {
  const preview = createElement('div', { class: styles.preview })

  if (content.image) {
    const img = createElement('img', {
      src: content.image,
      alt: content.title || ''
    })
    preview.appendChild(img)
  }

  const previewContent = createElement('div', { class: styles.previewContent })
  const link = createElement(
    'a',
    {
      href: content.url,
      target: '_blank',
      rel: 'noopener noreferrer'
    },
    content.title || content.url
  )
  previewContent.appendChild(link)

  if (content.description) {
    const desc = createElement('p', {}, content.description)
    previewContent.appendChild(desc)
  }

  preview.appendChild(previewContent)
  return preview.outerHTML
}

/**
 * Создает универсальный HTML для embed любой платформы
 * @param url URL для встраивания
 * @returns HTML строка или null если платформа не поддерживается
 */
export const createUniversalEmbed = async (
  url: string,
  platformOverride?: string,
  metadataOverride?: EmbedMetadata
): Promise<string | null> => {
  const platform = platformOverride || detectEmbedPlatform(url)

  // Получаем метаданные для preview (асинхронно), используя переданные если есть
  const metadata = metadataOverride || (await getEmbedMetadata(url, platform as keyof typeof OEMBED_ENDPOINTS))

  switch (platform) {
    case 'youtube':
    case 'vimeo':
      // Используем VideoPlayer компонент через data-атрибуты
      return createVideoEmbed(url)

    case 'twitch': {
      // Официальный Twitch embed
      // API: https://dev.twitch.tv/docs/embed/video-and-clips
      const wrapper = document.createElement('div')
      wrapper.className = 'twitch-embed'
      wrapper.setAttribute('data-embed-platform', 'twitch')
      wrapper.setAttribute('data-embed-url', url)

      // Извлекаем channel или video ID из URL
      const urlParts = url.split('/')
      const isVideo = url.includes('/videos/')
      const channelOrVideo = urlParts[urlParts.length - 1]

      // Twitch Player iframe
      // parent параметр обязателен для работы Twitch embed
      const parentDomain = typeof window !== 'undefined' ? window.location.hostname : 'discours.io'
      const iframe = document.createElement('iframe')
      iframe.src = isVideo
        ? `https://player.twitch.tv/?video=${channelOrVideo}&parent=${parentDomain}&autoplay=false`
        : `https://player.twitch.tv/?channel=${channelOrVideo}&parent=${parentDomain}&autoplay=false`
      iframe.height = '480'
      iframe.width = '100%'
      iframe.allowFullscreen = true
      iframe.frameBorder = '0'
      iframe.scrolling = 'no'

      wrapper.appendChild(iframe)
      return wrapper.outerHTML
    }

    case 'ted': {
      // Официальный TED embed с поддержкой субтитров
      // Docs: https://blog.ted.com/tedtalks_embed_1/
      // Docs: https://blog.ted.com/now-you-can-embed-tedtalks-with-subtitles-enabled/
      const wrapper = document.createElement('div')
      wrapper.className = 'ted-embed'
      wrapper.setAttribute('data-embed-platform', 'ted')
      wrapper.setAttribute('data-embed-url', url)

      // Извлекаем slug из URL
      // Поддерживаемые форматы:
      // - https://www.ted.com/talks/[slug]
      // - https://ted.com/talks/[slug]
      // - https://embed.ted.com/talks/[slug]
      // - https://www.ted.com/talks/lang/ru/[slug] (с языком)
      let embedUrl = url
      const talkMatch = url.match(/ted\.com\/talks\/(?:lang\/([a-z]{2})\/)?([a-zA-Z0-9_-]+)/)
      if (talkMatch) {
        const existingLang = talkMatch[1] // Язык из URL (если есть)
        const slug = talkMatch[2]

        // Определяем язык интерфейса (из localStorage или браузера)
        let userLang = 'en'
        if (typeof window !== 'undefined') {
          // Пробуем получить из настроек Discours.io
          userLang = localStorage.getItem('discourse-lang') || navigator.language.split('-')[0] || 'en'
        }

        // Используем язык из URL, если он есть, иначе язык пользователя
        const lang = existingLang || userLang

        // Официальный embed URL с языком субтитров
        // Формат: https://embed.ted.com/talks/lang/[lang]/[slug]
        embedUrl = `https://embed.ted.com/talks/lang/${lang}/${slug}`
      }

      // TED iframe - используем их официальный embed player
      const iframe = document.createElement('iframe')
      iframe.src = embedUrl
      iframe.width = '100%'
      iframe.height = '480'
      iframe.frameBorder = '0'
      iframe.scrolling = 'no'
      iframe.allowFullscreen = true
      iframe.style.maxWidth = '854px'

      wrapper.appendChild(iframe)
      return wrapper.outerHTML
    }

    case 'soundcloud': {
      // Официальный SoundCloud embed
      // API: https://developers.soundcloud.com/docs/api/html5-widget
      const wrapper = document.createElement('div')
      wrapper.className = 'soundcloud-embed'
      wrapper.setAttribute('data-embed-platform', 'soundcloud')
      wrapper.setAttribute('data-embed-url', url)

      const iframe = document.createElement('iframe')
      iframe.width = '100%'
      iframe.height = '166'
      iframe.scrolling = 'no'
      iframe.frameBorder = 'no'
      iframe.allow = 'autoplay'
      iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`

      wrapper.appendChild(iframe)
      return wrapper.outerHTML
    }

    case 'facebook': {
      // Официальный Facebook embed с lazy loading
      // SDK: https://developers.facebook.com/docs/plugins/embedded-posts/
      const wrapper = document.createElement('div')
      wrapper.className = 'facebook-embed embed-lazy'
      wrapper.setAttribute('data-embed-platform', 'facebook')
      wrapper.setAttribute('data-embed-url', url)
      wrapper.setAttribute('data-sdk-loaded', 'false')

      // Создаем placeholder с кнопкой активации
      const placeholder = document.createElement('div')
      placeholder.className = 'embed-placeholder'
      placeholder.style.padding = '20px'
      placeholder.style.border = '1px solid #e1e8ed'
      placeholder.style.borderRadius = '8px'
      placeholder.style.textAlign = 'center'
      placeholder.style.backgroundColor = '#f7f9fa'

      // Добавляем metadata preview если доступен
      if (metadata) {
        placeholder.innerHTML = createMetadataPreview(metadata, 'Facebook', '#1877f2')
      } else {
        const icon = document.createElement('div')
        icon.innerHTML = '📘'
        icon.style.fontSize = '32px'
        icon.style.marginBottom = '10px'

        const text = document.createElement('div')
        text.textContent = 'Facebook post'
        text.style.marginBottom = '10px'
        text.style.color = '#333'

        placeholder.appendChild(icon)
        placeholder.appendChild(text)
      }

      const button = document.createElement('button')
      button.textContent = 'Load full content'
      button.className = 'embed-load-button'
      button.style.padding = '8px 16px'
      button.style.backgroundColor = '#1877f2'
      button.style.color = 'white'
      button.style.border = 'none'
      button.style.borderRadius = '4px'
      button.style.cursor = 'pointer'
      button.setAttribute('data-embed-action', 'load')

      const privacy = document.createElement('div')
      privacy.textContent = 'Connects to Facebook servers'
      privacy.style.fontSize = '12px'
      privacy.style.color = '#666'
      privacy.style.marginTop = '8px'

      placeholder.appendChild(button)
      placeholder.appendChild(privacy)

      // Facebook embed контейнер (скрыт до загрузки)
      const fbPost = document.createElement('div')
      fbPost.className = 'fb-post'
      fbPost.setAttribute('data-href', url)
      fbPost.setAttribute('data-width', '500')
      fbPost.setAttribute('data-show-text', 'true')
      fbPost.style.display = 'none'

      wrapper.appendChild(placeholder)
      wrapper.appendChild(fbPost)

      return wrapper.outerHTML
    }

    case 'x': {
      // Официальный X (Twitter) embed с lazy loading
      // SDK: https://developer.twitter.com/en/docs/twitter-for-websites/embedded-tweets/overview
      const wrapper = document.createElement('div')
      wrapper.className = 'x-embed twitter-embed embed-lazy'
      wrapper.setAttribute('data-embed-platform', 'x')
      wrapper.setAttribute('data-embed-url', url)
      wrapper.setAttribute('data-sdk-loaded', 'false')

      // Создаем placeholder с кнопкой активации
      const placeholder = document.createElement('div')
      placeholder.className = 'embed-placeholder'
      placeholder.style.padding = '20px'
      placeholder.style.border = '1px solid #e1e8ed'
      placeholder.style.borderRadius = '8px'
      placeholder.style.textAlign = 'center'
      placeholder.style.backgroundColor = '#f7f9fa'

      // Добавляем metadata preview если доступен
      if (metadata) {
        placeholder.innerHTML = createMetadataPreview(metadata, 'X', '#1da1f2')
      } else {
        const icon = document.createElement('div')
        icon.innerHTML = '𝕏'
        icon.style.fontSize = '32px'
        icon.style.marginBottom = '10px'

        const text = document.createElement('div')
        text.textContent = 'Post from X (Twitter)'
        text.style.marginBottom = '10px'
        text.style.color = '#333'

        placeholder.appendChild(icon)
        placeholder.appendChild(text)
      }

      const button = document.createElement('button')
      button.textContent = 'Load full content'
      button.className = 'embed-load-button'
      button.style.padding = '8px 16px'
      button.style.backgroundColor = '#1da1f2'
      button.style.color = 'white'
      button.style.border = 'none'
      button.style.borderRadius = '4px'
      button.style.cursor = 'pointer'
      button.setAttribute('data-embed-action', 'load')

      const privacy = document.createElement('div')
      privacy.textContent = 'Connects to X/Twitter servers'
      privacy.style.fontSize = '12px'
      privacy.style.color = '#666'
      privacy.style.marginTop = '8px'

      placeholder.appendChild(button)
      placeholder.appendChild(privacy)

      // Twitter embed контейнер (скрыт до загрузки)
      const blockquote = document.createElement('blockquote')
      blockquote.className = 'twitter-tweet'
      blockquote.setAttribute('data-theme', 'light')
      blockquote.style.display = 'none'

      const link = document.createElement('a')
      link.href = url
      link.textContent = 'View post on X'
      blockquote.appendChild(link)

      wrapper.appendChild(placeholder)
      wrapper.appendChild(blockquote)

      return wrapper.outerHTML
    }

    case 'instagram': {
      // Официальный Instagram embed с lazy loading
      // SDK: https://developers.facebook.com/docs/instagram/embedding
      const wrapper = document.createElement('div')
      wrapper.className = 'instagram-embed embed-lazy'
      wrapper.setAttribute('data-embed-platform', 'instagram')
      wrapper.setAttribute('data-embed-url', url)
      wrapper.setAttribute('data-sdk-loaded', 'false')

      // Создаем placeholder с кнопкой активации
      const placeholder = document.createElement('div')
      placeholder.className = 'embed-placeholder'
      placeholder.style.padding = '20px'
      placeholder.style.border = '1px solid #e1e8ed'
      placeholder.style.borderRadius = '8px'
      placeholder.style.textAlign = 'center'
      placeholder.style.backgroundColor = '#f7f9fa'

      // Добавляем metadata preview если доступен
      if (metadata) {
        placeholder.innerHTML = createMetadataPreview(metadata, 'Instagram', '#E1306C')
      } else {
        const icon = document.createElement('div')
        icon.innerHTML = '📷'
        icon.style.fontSize = '32px'
        icon.style.marginBottom = '10px'

        const text = document.createElement('div')
        text.textContent = 'Instagram post'
        text.style.marginBottom = '10px'
        text.style.color = '#333'

        placeholder.appendChild(icon)
        placeholder.appendChild(text)
      }

      const button = document.createElement('button')
      button.textContent = 'Load full content'
      button.className = 'embed-load-button'
      button.style.padding = '8px 16px'
      button.style.background = 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)'
      button.style.color = 'white'
      button.style.border = 'none'
      button.style.borderRadius = '4px'
      button.style.cursor = 'pointer'
      button.setAttribute('data-embed-action', 'load')

      const privacy = document.createElement('div')
      privacy.textContent = 'Connects to Instagram servers'
      privacy.style.fontSize = '12px'
      privacy.style.color = '#666'
      privacy.style.marginTop = '8px'

      placeholder.appendChild(button)
      placeholder.appendChild(privacy)

      // Instagram embed контейнер (скрыт до загрузки)
      const blockquote = document.createElement('blockquote')
      blockquote.className = 'instagram-media'
      blockquote.setAttribute('data-instgrm-permalink', url)
      blockquote.setAttribute('data-instgrm-version', '14')
      blockquote.style.display = 'none'
      blockquote.style.background = '#FFF'
      blockquote.style.border = '0'
      blockquote.style.borderRadius = '3px'
      blockquote.style.margin = '1px'
      blockquote.style.maxWidth = '540px'
      blockquote.style.minWidth = '326px'
      blockquote.style.padding = '0'
      blockquote.style.width = '99.375%'

      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      link.textContent = 'View this post on Instagram'
      blockquote.appendChild(link)

      wrapper.appendChild(placeholder)
      wrapper.appendChild(blockquote)

      return wrapper.outerHTML
    }

    case 'telegram': {
      // Официальный Telegram embed
      // API: https://core.telegram.org/widgets/post
      const wrapper = document.createElement('div')
      wrapper.className = 'telegram-embed'
      wrapper.setAttribute('data-embed-platform', 'telegram')
      wrapper.setAttribute('data-embed-url', url)

      // Telegram использует специальный формат для embed
      // Пример: https://t.me/channelname/123 -> https://t.me/channelname/123?embed=1
      const _embedUrl = url.includes('?') ? `${url}&embed=1` : `${url}?embed=1`

      // Создаем script tag для Telegram widget
      const script = document.createElement('script')
      script.async = true
      script.src = 'https://telegram.org/js/telegram-widget.js?22'
      script.setAttribute('data-telegram-post', url.replace('https://t.me/', ''))
      script.setAttribute('data-width', '100%')

      wrapper.appendChild(script)

      return wrapper.outerHTML
    }

    case 'reddit': {
      // Официальный Reddit embed с lazy loading
      // API: https://www.reddit.com/wiki/oembeds
      const wrapper = document.createElement('div')
      wrapper.className = 'reddit-embed embed-lazy'
      wrapper.setAttribute('data-embed-platform', 'reddit')
      wrapper.setAttribute('data-embed-url', url)
      wrapper.setAttribute('data-sdk-loaded', 'false')

      // Создаем placeholder с кнопкой активации
      const placeholder = document.createElement('div')
      placeholder.className = 'embed-placeholder'
      placeholder.style.padding = '20px'
      placeholder.style.border = '1px solid #e1e8ed'
      placeholder.style.borderRadius = '8px'
      placeholder.style.textAlign = 'center'
      placeholder.style.backgroundColor = '#f7f9fa'

      // Добавляем metadata preview если доступен
      if (metadata) {
        placeholder.innerHTML = createMetadataPreview(metadata, 'Reddit', '#FF4500')
      } else {
        const icon = document.createElement('div')
        icon.innerHTML = '🤖'
        icon.style.fontSize = '32px'
        icon.style.marginBottom = '10px'

        const text = document.createElement('div')
        text.textContent = 'Reddit post'
        text.style.marginBottom = '10px'
        text.style.color = '#333'

        placeholder.appendChild(icon)
        placeholder.appendChild(text)
      }

      const button = document.createElement('button')
      button.textContent = 'Load full content'
      button.className = 'embed-load-button'
      button.style.padding = '8px 16px'
      button.style.backgroundColor = '#FF4500'
      button.style.color = 'white'
      button.style.border = 'none'
      button.style.borderRadius = '4px'
      button.style.cursor = 'pointer'
      button.setAttribute('data-embed-action', 'load')

      const privacy = document.createElement('div')
      privacy.textContent = 'Connects to Reddit servers'
      privacy.style.fontSize = '12px'
      privacy.style.color = '#666'
      privacy.style.marginTop = '8px'

      placeholder.appendChild(button)
      placeholder.appendChild(privacy)

      // Reddit embed контейнер (скрыт до загрузки)
      const blockquote = document.createElement('blockquote')
      blockquote.className = 'reddit-embed-bq'
      blockquote.setAttribute('data-embed-height', '500')
      blockquote.style.display = 'none'

      const link = document.createElement('a')
      link.href = url
      link.textContent = 'View on Reddit'
      blockquote.appendChild(link)

      wrapper.appendChild(placeholder)
      wrapper.appendChild(blockquote)

      return wrapper.outerHTML
    }

    case 'tiktok': {
      // Официальный TikTok embed с lazy loading
      // API: https://developers.tiktok.com/doc/embed-videos
      const wrapper = document.createElement('div')
      wrapper.className = 'tiktok-embed embed-lazy'
      wrapper.setAttribute('data-embed-platform', 'tiktok')
      wrapper.setAttribute('data-embed-url', url)
      wrapper.setAttribute('data-sdk-loaded', 'false')

      // Создаем placeholder с кнопкой активации
      const placeholder = document.createElement('div')
      placeholder.className = 'embed-placeholder'
      placeholder.style.padding = '20px'
      placeholder.style.border = '1px solid #e1e8ed'
      placeholder.style.borderRadius = '8px'
      placeholder.style.textAlign = 'center'
      placeholder.style.backgroundColor = '#f7f9fa'

      // Добавляем metadata preview если доступен
      if (metadata) {
        placeholder.innerHTML = createMetadataPreview(metadata, 'TikTok', '#000')
      } else {
        const icon = document.createElement('div')
        icon.innerHTML = '🎵'
        icon.style.fontSize = '32px'
        icon.style.marginBottom = '10px'

        const text = document.createElement('div')
        text.textContent = 'TikTok video'
        text.style.marginBottom = '10px'
        text.style.color = '#333'

        placeholder.appendChild(icon)
        placeholder.appendChild(text)
      }

      const button = document.createElement('button')
      button.textContent = 'Load full content'
      button.className = 'embed-load-button'
      button.style.padding = '8px 16px'
      button.style.backgroundColor = '#000'
      button.style.color = 'white'
      button.style.border = 'none'
      button.style.borderRadius = '4px'
      button.style.cursor = 'pointer'
      button.setAttribute('data-embed-action', 'load')

      const privacy = document.createElement('div')
      privacy.textContent = 'Connects to TikTok servers'
      privacy.style.fontSize = '12px'
      privacy.style.color = '#666'
      privacy.style.marginTop = '8px'

      placeholder.appendChild(button)
      placeholder.appendChild(privacy)

      // TikTok embed контейнер (скрыт до загрузки)
      const blockquote = document.createElement('blockquote')
      blockquote.className = 'tiktok-embed'
      blockquote.setAttribute('cite', url)
      blockquote.setAttribute('data-video-id', url.split('/').pop() || '')
      blockquote.style.display = 'none'
      blockquote.style.maxWidth = '605px'
      blockquote.style.minWidth = '325px'

      wrapper.appendChild(placeholder)
      wrapper.appendChild(blockquote)

      return wrapper.outerHTML
    }

    case 'bandcamp': {
      // Официальный Bandcamp embed через oEmbed API
      // API: https://bandcamp.com/developer
      // Docs: https://bandcamp.com/developer#oembed
      const wrapper = document.createElement('div')
      wrapper.className = 'bandcamp-embed embed-lazy'
      wrapper.setAttribute('data-embed-platform', 'bandcamp')
      wrapper.setAttribute('data-embed-url', url)
      wrapper.setAttribute('data-sdk-loaded', 'false')

      // Создаем placeholder с кнопкой активации
      const placeholder = document.createElement('div')
      placeholder.className = 'embed-placeholder'
      placeholder.style.padding = '20px'
      placeholder.style.border = '1px solid #629aa9'
      placeholder.style.borderRadius = '8px'
      placeholder.style.textAlign = 'center'
      placeholder.style.backgroundColor = '#f4f7f8'

      // Добавляем metadata preview если доступен
      if (metadata) {
        placeholder.innerHTML = createMetadataPreview(metadata, 'Bandcamp', '#629aa9')
      } else {
        const icon = document.createElement('div')
        icon.innerHTML = '🎵'
        icon.style.fontSize = '32px'
        icon.style.marginBottom = '10px'

        const text = document.createElement('div')
        text.textContent = 'Bandcamp'
        text.style.marginBottom = '10px'
        text.style.color = '#333'
        text.style.fontWeight = 'bold'

        placeholder.appendChild(icon)
        placeholder.appendChild(text)
      }

      const button = document.createElement('button')
      button.textContent = 'Load player'
      button.className = 'embed-load-button'
      button.style.padding = '8px 16px'
      button.style.backgroundColor = '#629aa9'
      button.style.color = 'white'
      button.style.border = 'none'
      button.style.borderRadius = '4px'
      button.style.cursor = 'pointer'
      button.setAttribute('data-embed-action', 'load')

      const privacy = document.createElement('div')
      privacy.textContent = 'Connects to Bandcamp servers'
      privacy.style.fontSize = '12px'
      privacy.style.color = '#666'
      privacy.style.marginTop = '8px'

      placeholder.appendChild(button)
      placeholder.appendChild(privacy)

      // Bandcamp iframe контейнер (будет заполнен через oEmbed)
      const iframeContainer = document.createElement('div')
      iframeContainer.className = 'bandcamp-iframe-container'
      iframeContainer.style.display = 'none'
      iframeContainer.setAttribute(
        'data-oembed-url',
        `https://bandcamp.com/api/oembed?url=${encodeURIComponent(url)}&format=json`
      )

      wrapper.appendChild(placeholder)
      wrapper.appendChild(iframeContainer)

      return wrapper.outerHTML
    }

    case 'wikipedia': {
      // Wikipedia embed - iframe с превью
      const wrapper = document.createElement('div')
      wrapper.className = 'wikipedia-embed'
      wrapper.setAttribute('data-embed-platform', 'wikipedia')
      wrapper.setAttribute('data-embed-url', url)

      // Извлекаем язык и название статьи из URL
      // Примеры: https://en.wikipedia.org/wiki/Article, https://ru.wikipedia.org/wiki/Статья
      const urlMatch = url.match(/\/\/([a-z]{2,3})\.wikipedia\.org\/wiki\/(.+)/)
      const lang = urlMatch?.[1] || 'en'
      const article = urlMatch?.[2] || ''

      if (metadata) {
        // Если есть метаданные - показываем превью
        const preview = document.createElement('div')
        preview.className = 'wikipedia-preview'
        preview.style.border = '1px solid #e1e8ed'
        preview.style.borderRadius = '8px'
        preview.style.padding = '16px'
        preview.style.backgroundColor = '#f8f9fa'
        preview.innerHTML = createMetadataPreview(metadata, 'Wikipedia', '#000')
        wrapper.appendChild(preview)
      } else {
        // Fallback - простая iframe или ссылка
        const iframe = document.createElement('iframe')
        iframe.src = `https://${lang}.wikipedia.org/wiki/${article}`
        iframe.width = '100%'
        iframe.height = '400'
        iframe.frameBorder = '0'
        iframe.scrolling = 'yes'
        iframe.style.border = '1px solid #e1e8ed'
        iframe.style.borderRadius = '8px'
        wrapper.appendChild(iframe)
      }

      return wrapper.outerHTML
    }

    case 'discours': {
      // Для Discours.io создаем простую ссылку-превью
      const wrapper = document.createElement('div')
      wrapper.className = 'discours-embed'
      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.textContent = url
      wrapper.appendChild(link)
      return wrapper.outerHTML
    }

    case 'slideshare': {
      // SlideShare embed - iframe из oEmbed API
      const wrapper = document.createElement('div')
      wrapper.className = 'slideshare-embed embed-lazy'
      wrapper.setAttribute('data-embed-platform', 'slideshare')
      wrapper.setAttribute('data-embed-url', url)
      wrapper.setAttribute('data-sdk-loaded', 'false')

      // Placeholder с кнопкой загрузки
      const placeholder = document.createElement('div')
      placeholder.className = 'embed-placeholder'
      placeholder.style.padding = '20px'
      placeholder.style.border = '1px solid #e1e8ed'
      placeholder.style.borderRadius = '8px'
      placeholder.style.textAlign = 'center'
      placeholder.style.backgroundColor = '#f7f9fa'

      if (metadata) {
        placeholder.innerHTML = createMetadataPreview(metadata, 'SlideShare', '#e68523')
      } else {
        placeholder.innerHTML = `
          <div style="font-size: 24px; margin-bottom: 10px;">📊</div>
          <div style="font-weight: 600; margin-bottom: 8px;">SlideShare Presentation</div>
          <div style="font-size: 14px; color: #657786; margin-bottom: 12px;">${url}</div>
        `
      }

      const loadButton = document.createElement('button')
      loadButton.className = 'embed-load-button'
      loadButton.textContent = 'Load presentation'
      loadButton.style.padding = '8px 16px'
      loadButton.style.backgroundColor = '#e68523'
      loadButton.style.color = 'white'
      loadButton.style.border = 'none'
      loadButton.style.borderRadius = '4px'
      loadButton.style.cursor = 'pointer'
      loadButton.style.fontWeight = '600'
      placeholder.appendChild(loadButton)

      // Privacy warning
      const privacyWarning = document.createElement('div')
      privacyWarning.style.fontSize = '12px'
      privacyWarning.style.color = '#999'
      privacyWarning.style.marginTop = '12px'
      privacyWarning.textContent = '🔒 Will load external content from SlideShare'
      placeholder.appendChild(privacyWarning)

      wrapper.appendChild(placeholder)

      // Container для iframe (будет заполнен при клике)
      const iframeContainer = document.createElement('div')
      iframeContainer.className = 'slideshare-iframe-container'
      iframeContainer.style.display = 'none'
      iframeContainer.setAttribute(
        'data-oembed-url',
        `https://www.slideshare.net/api/oembed/2?url=${encodeURIComponent(url)}&format=json`
      )
      wrapper.appendChild(iframeContainer)

      return wrapper.outerHTML
    }

    case 'imgur': {
      // Imgur embed - может быть изображение или галерея
      const wrapper = document.createElement('div')
      wrapper.className = 'imgur-embed'
      wrapper.setAttribute('data-embed-platform', 'imgur')
      wrapper.setAttribute('data-embed-url', url)

      // Определяем тип Imgur контента
      const isGallery = url.includes('/gallery/') || url.includes('/a/')
      const imgurId = url.match(/\/([a-zA-Z0-9]+)(?:\.[a-z]+)?$/)?.[1]

      if (isGallery && imgurId) {
        // Для галереи - используем blockquote embed
        const blockquote = document.createElement('blockquote')
        blockquote.className = 'imgur-embed-pub'
        blockquote.setAttribute('lang', 'en')
        blockquote.setAttribute('data-id', imgurId)

        const link = document.createElement('a')
        link.href = url
        link.textContent = 'View on Imgur'
        blockquote.appendChild(link)

        wrapper.appendChild(blockquote)

        // Скрипт для загрузки Imgur embed
        const script = document.createElement('script')
        script.async = true
        script.src = '//s.imgur.com/min/embed.js'
        script.charset = 'utf-8'
        wrapper.appendChild(script)
      } else if (imgurId) {
        // Для прямого изображения - вставляем img
        const img = document.createElement('img')
        img.src = `https://i.imgur.com/${imgurId}.jpg`
        img.alt = 'Imgur image'
        img.style.maxWidth = '100%'
        img.style.height = 'auto'
        wrapper.appendChild(img)
      } else {
        // Fallback - простая ссылка
        const link = document.createElement('a')
        link.href = url
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.textContent = url
        wrapper.appendChild(link)
      }

      return wrapper.outerHTML
    }

    case 'flickr': {
      // Flickr embed - iframe из oEmbed API
      const wrapper = document.createElement('div')
      wrapper.className = 'flickr-embed embed-lazy'
      wrapper.setAttribute('data-embed-platform', 'flickr')
      wrapper.setAttribute('data-embed-url', url)
      wrapper.setAttribute('data-sdk-loaded', 'false')

      // Placeholder с кнопкой загрузки
      const placeholder = document.createElement('div')
      placeholder.className = 'embed-placeholder'
      placeholder.style.padding = '20px'
      placeholder.style.border = '1px solid #e1e8ed'
      placeholder.style.borderRadius = '8px'
      placeholder.style.textAlign = 'center'
      placeholder.style.backgroundColor = '#f7f9fa'

      if (metadata) {
        placeholder.innerHTML = createMetadataPreview(metadata, 'Flickr', '#0063dc')
      } else {
        placeholder.innerHTML = `
          <div style="font-size: 24px; margin-bottom: 10px;">📷</div>
          <div style="font-weight: 600; margin-bottom: 8px;">Flickr Photo</div>
          <div style="font-size: 14px; color: #657786; margin-bottom: 12px;">${url}</div>
        `
      }

      const loadButton = document.createElement('button')
      loadButton.className = 'embed-load-button'
      loadButton.textContent = 'Load photo'
      loadButton.style.padding = '8px 16px'
      loadButton.style.backgroundColor = '#0063dc'
      loadButton.style.color = 'white'
      loadButton.style.border = 'none'
      loadButton.style.borderRadius = '4px'
      loadButton.style.cursor = 'pointer'
      loadButton.style.fontWeight = '600'
      placeholder.appendChild(loadButton)

      // Privacy warning
      const privacyWarning = document.createElement('div')
      privacyWarning.style.fontSize = '12px'
      privacyWarning.style.color = '#999'
      privacyWarning.style.marginTop = '12px'
      privacyWarning.textContent = '🔒 Will load external content from Flickr'
      placeholder.appendChild(privacyWarning)

      wrapper.appendChild(placeholder)

      // Container для iframe (будет заполнен при клике)
      const iframeContainer = document.createElement('div')
      iframeContainer.className = 'flickr-iframe-container'
      iframeContainer.style.display = 'none'
      iframeContainer.setAttribute(
        'data-oembed-url',
        `https://www.flickr.com/services/oembed?url=${encodeURIComponent(url)}&format=json`
      )
      wrapper.appendChild(iframeContainer)

      return wrapper.outerHTML
    }

    default:
      return null
  }
}

/**
 * Создает HTML для вставки медиа в редактор (универсальная функция)
 * @param params Параметры медиа
 * @returns HTML строка для вставки
 */
export const createMediaHTML = (params: MediaInsertParams): string => {
  const { type, url, title = '', attributes = {} } = params

  // Собираем строку атрибутов
  const attributesStr = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')

  switch (type) {
    case 'image':
      // Используем createImageEmbed для правильной структуры <figure><img></figure>
      return createImageEmbed({ type: 'image', url, title })
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
