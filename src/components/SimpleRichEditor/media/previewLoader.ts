/**
 * @module media/previewLoader
 * @description Lazy loading SDK для embed виджетов с защитой приватности
 *
 * Принцип: SDK загружаются ТОЛЬКО после явного согласия пользователя
 * Это снижает:
 * - Tracking пользователей
 * - Время загрузки страницы
 * - Утечку данных
 */

import type { EmbedPlatform } from './types'

type LazyPreviewPlatform =
  | 'facebook'
  | 'x'
  | 'instagram'
  | 'telegram'
  | 'reddit'
  | 'tiktok'
  | 'bandcamp'
  | 'slideshare'
  | 'flickr'
  | 'imgur'
  | 'ok'

// Хранилище загруженных SDK
const loadedSDKs = new Set<LazyPreviewPlatform>()

/**
 * Загружает Facebook SDK
 */
const loadFacebookSDK = (): Promise<void> => {
  if (loadedSDKs.has('facebook')) {
    // Повторно парсим, если SDK уже загружен
    if (window.FB) {
      window.FB.XFBML.parse()
    }
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    // Создаем div для FB root если его нет
    if (!document.getElementById('fb-root')) {
      const fbRoot = document.createElement('div')
      fbRoot.id = 'fb-root'
      document.body.insertBefore(fbRoot, document.body.firstChild)
    }

    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.src = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0'
    script.async = true
    script.defer = true
    script.onload = () => {
      loadedSDKs.add('facebook')
      resolve()
    }
    document.body.appendChild(script)
  })
}

/**
 * Загружает X (Twitter) SDK
 */
const loadTwitterSDK = (): Promise<void> => {
  if (loadedSDKs.has('x')) {
    // Повторно парсим, если SDK уже загружен
    if (window.twttr?.widgets) {
      window.twttr.widgets.load()
    }
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.charset = 'utf-8'
    script.onload = () => {
      loadedSDKs.add('x')
      resolve()
    }
    document.body.appendChild(script)
  })
}

/**
 * Загружает Instagram SDK
 */
const loadInstagramSDK = (): Promise<void> => {
  if (loadedSDKs.has('instagram')) {
    // Повторно парсим, если SDK уже загружен
    if (window.instgrm?.Embeds) {
      window.instgrm.Embeds.process()
    }
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = '//www.instagram.com/embed.js'
    script.async = true
    script.onload = () => {
      loadedSDKs.add('instagram')
      resolve()
    }
    document.body.appendChild(script)
  })
}

/**
 * Загружает Reddit SDK
 */
const loadRedditSDK = (): Promise<void> => {
  if (loadedSDKs.has('reddit')) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://embed.reddit.com/widgets.js'
    script.async = true
    script.charset = 'UTF-8'
    script.onload = () => {
      loadedSDKs.add('reddit')
      resolve()
    }
    document.body.appendChild(script)
  })
}

/**
 * Загружает TikTok SDK
 */
const loadTikTokSDK = (): Promise<void> => {
  if (loadedSDKs.has('tiktok')) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://www.tiktok.com/embed.js'
    script.async = true
    script.onload = () => {
      loadedSDKs.add('tiktok')
      resolve()
    }
    document.body.appendChild(script)
  })
}

/**
 * Загружает Bandcamp embed через oEmbed API
 */
const loadBandcampEmbed = async (wrapper: HTMLElement): Promise<void> => {
  if (loadedSDKs.has('bandcamp')) {
    return Promise.resolve()
  }

  const container = wrapper.querySelector('.bandcamp-iframe-container') as HTMLElement
  if (!container) return

  const oembedUrl = container.getAttribute('data-oembed-url')
  if (!oembedUrl) return

  try {
    const response = await fetch(oembedUrl)
    const data = await response.json()

    if (data.html) {
      container.innerHTML = data.html
      container.style.display = 'block'
      loadedSDKs.add('bandcamp')
    }
  } catch (error) {
    console.error('Failed to load Bandcamp oEmbed:', error)
    throw error
  }
}

/**
 * 🗣️ Загружает OK.ru embed (iframe, без SDK)
 * Одноклассники используют iframe embed
 */
const loadOKEmbed = async (wrapper: HTMLElement): Promise<void> => {
  if (loadedSDKs.has('ok')) {
    return Promise.resolve()
  }

  const container = wrapper.querySelector('.ok-iframe-container') as HTMLElement
  if (!container) return

  const videoUrl = container.getAttribute('data-video-url')
  if (!videoUrl) return

  try {
    // OK.ru использует iframe напрямую
    const iframe = document.createElement('iframe')
    iframe.src = videoUrl
    iframe.style.cssText = 'border: 0; width: 100%; height: 400px;'
    iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media')
    iframe.setAttribute('allowfullscreen', 'true')
    iframe.setAttribute('frameborder', '0')

    container.appendChild(iframe)
    loadedSDKs.add('ok')
  } catch (error) {
    console.error('[embedLoader] OK.ru embed failed:', error)
    throw error
  }
}

/**
 * Инициализирует embed после загрузки SDK
 */
export const initializeEmbedLazy = async (
  wrapper: HTMLElement,
  platform: EmbedPlatform | LazyPreviewPlatform
): Promise<void> => {
  const placeholder = wrapper.querySelector('.embed-placeholder')
  // Ищем контент в зависимости от платформы
  const content = wrapper.querySelector(
    '.fb-post, .twitter-tweet, .instagram-media, .reddit-embed-bq, .tiktok-embed, .bandcamp-iframe-container, .slideshare-iframe-container, .flickr-iframe-container, .imgur-embed-pub, .ok-iframe-container, script'
  ) as HTMLElement

  if (!content && !['bandcamp', 'slideshare', 'flickr', 'ok'].includes(platform)) return

  try {
    // Показываем индикатор загрузки
    const button = placeholder?.querySelector('[data-embed-action="load"]')
    if (button) {
      button.textContent = 'Loading...'
      ;(button as HTMLButtonElement).disabled = true
    }

    // Загружаем SDK
    switch (platform) {
      case 'facebook':
        await loadFacebookSDK()
        break
      case 'x':
        await loadTwitterSDK()
        break
      case 'instagram':
        await loadInstagramSDK()
        break
      case 'reddit':
        await loadRedditSDK()
        break
      case 'tiktok':
        await loadTikTokSDK()
        break
      case 'bandcamp':
        await loadBandcampEmbed(wrapper)
        break
      case 'telegram':
        // Telegram не требует отдельной загрузки SDK
        break
      case 'slideshare':
        await loadSlideshareEmbed(wrapper)
        break
      case 'flickr':
        await loadFlickrEmbed(wrapper)
        break
      case 'imgur':
        // Imgur не требует отдельной загрузки (уже загружен в html.ts)
        break
      case 'ok':
        // 🗣️ OK.ru: iframe embed без SDK
        await loadOKEmbed(wrapper)
        break
    }

    // Скрываем placeholder и показываем контент
    if (placeholder) {
      placeholder.remove()
    }
    if (content) {
      content.style.display = 'block'
    }
    wrapper.setAttribute('data-sdk-loaded', 'true')
  } catch (error) {
    console.error(`Failed to load ${platform} embed:`, error)
    if (placeholder) {
      const errorText = document.createElement('div')
      errorText.textContent = 'Failed to load content'
      errorText.style.color = '#f00'
      placeholder.appendChild(errorText)
    }
  }
}

/**
 * Инициализирует обработчики для всех lazy embed на странице
 */
export const initEmbedLoaders = (): void => {
  // Используем делегирование событий для динамически добавляемых embed
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.getAttribute('data-embed-action') === 'load') {
      const wrapper = target.closest('[data-embed-platform]') as HTMLElement
      if (wrapper) {
        const platform = wrapper.getAttribute('data-embed-platform') as LazyPreviewPlatform
        const loaded = wrapper.getAttribute('data-sdk-loaded') === 'true'

        if (!loaded && platform) {
          void initializeEmbedLazy(wrapper, platform)
        }
      }
    }
  })
}

/**
 * Загружает SlideShare embed через oEmbed API
 */
async function loadSlideshareEmbed(wrapper: HTMLElement): Promise<void> {
  const container = wrapper.querySelector('.slideshare-iframe-container') as HTMLElement
  if (!container) return

  const oembedUrl = container.getAttribute('data-oembed-url')
  if (!oembedUrl) return

  try {
    const response = await fetch(oembedUrl)
    const data = await response.json()

    if (data.html) {
      container.innerHTML = data.html
    }
  } catch (error) {
    console.error('Failed to load SlideShare embed:', error)
    container.innerHTML = '<p>Failed to load SlideShare presentation</p>'
  }
}

/**
 * Загружает Flickr embed через oEmbed API
 */
async function loadFlickrEmbed(wrapper: HTMLElement): Promise<void> {
  const container = wrapper.querySelector('.flickr-iframe-container') as HTMLElement
  if (!container) return

  const oembedUrl = container.getAttribute('data-oembed-url')
  if (!oembedUrl) return

  try {
    const response = await fetch(oembedUrl)
    const data = await response.json()

    if (data.html) {
      container.innerHTML = data.html
    }
  } catch (error) {
    console.error('Failed to load Flickr embed:', error)
    container.innerHTML = '<p>Failed to load Flickr photo</p>'
  }
}

// TypeScript расширения для window
declare global {
  interface Window {
    FB?: {
      XFBML: {
        parse: () => void
      }
    }
    twttr?: {
      widgets: {
        load: () => void
      }
    }
    instgrm?: {
      Embeds: {
        process: () => void
      }
    }
  }
}
