/**
 * @module utils/customTags
 * @description Обработка кастомных HTML тегов (<tooltip>, <embed>)
 */

import type { EmbedPlatform } from '~/components/SimpleRichEditor/media/types'

/**
 * Обрабатывает <tooltip> теги, превращая их в интерактивные тултипы
 *
 * <tooltip>Текст тултипа</tooltip> → иконка с тултипом при наведении
 */
export const processTooltips = (container: HTMLElement) => {
  const tooltips = container.querySelectorAll('tooltip')

  tooltips.forEach((tooltip) => {
    const text = tooltip.textContent || ''

    // Создаем wrapper для тултипа
    const wrapper = document.createElement('span')
    wrapper.className = 'tooltip-wrapper'
    wrapper.style.cssText = `
      display: inline-block;
      position: relative;
      cursor: help;
      margin: 0 2px;
    `

    // Создаем иконку
    const icon = document.createElement('span')
    icon.className = 'tooltip-icon'
    icon.textContent = 'ⓘ'
    icon.style.cssText = `
      display: inline-block;
      width: 14px;
      height: 14px;
      line-height: 14px;
      text-align: center;
      font-size: 10px;
      font-weight: bold;
      color: #666;
      background: #f0f0f0;
      border-radius: 50%;
      vertical-align: super;
    `

    // Создаем сам тултип (скрытый по умолчанию)
    const tooltipContent = document.createElement('span')
    tooltipContent.className = 'tooltip-content'
    tooltipContent.textContent = text
    tooltipContent.style.cssText = `
      display: none;
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 8px;
      padding: 8px 12px;
      background: #333;
      color: #fff;
      font-size: 14px;
      border-radius: 4px;
      white-space: nowrap;
      z-index: 1000;
      pointer-events: none;
      min-width: 200px;
      max-width: 400px;
      white-space: normal;
      text-align: left;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `

    // Стрелочка для тултипа
    const arrow = document.createElement('span')
    arrow.className = 'tooltip-arrow'
    arrow.style.cssText = `
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid #333;
    `
    tooltipContent.appendChild(arrow)

    // События для показа/скрытия
    icon.addEventListener('mouseenter', () => {
      tooltipContent.style.display = 'block'
    })

    icon.addEventListener('mouseleave', () => {
      tooltipContent.style.display = 'none'
    })

    // Собираем wrapper
    wrapper.appendChild(icon)
    wrapper.appendChild(tooltipContent)

    // Заменяем оригинальный тег
    tooltip.replaceWith(wrapper)
  })
}

/**
 * Определяет платформу по URL
 */
function detectPlatformFromUrl(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('vimeo.com')) return 'vimeo'
  if (url.includes('soundcloud.com')) return 'soundcloud'
  if (url.includes('bandcamp.com')) return 'bandcamp'
  if (url.includes('facebook.com')) return 'facebook'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'x'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('t.me')) return 'telegram'
  if (url.includes('reddit.com')) return 'reddit'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('twitch.tv')) return 'twitch'
  if (url.includes('ted.com')) return 'ted'
  if (url.includes('wikipedia.org')) return 'wikipedia'
  if (url.includes('slideshare.net')) return 'slideshare'
  if (url.includes('imgur.com')) return 'imgur'
  if (url.includes('flickr.com')) return 'flickr'
  if (url.includes('discours.io')) return 'discours'
  return 'unknown'
}

/**
 * Обрабатывает <embed> теги
 *
 * Для YouTube/Vimeo: сразу создает iframe
 * Для остальных платформ: показывает превью с кнопкой загрузки
 *
 * <embed>https://youtube.com/watch?v=...</embed> → iframe
 * <embed>https://facebook.com/...</embed> → превью с кнопкой
 */
export const processEmbeds = async (container: HTMLElement) => {
  const embeds = container.querySelectorAll('embed')

  for (const embed of Array.from(embeds)) {
    const url = embed.textContent?.trim() || ''

    if (!url || !url.startsWith('http')) continue

    // Определяем платформу по URL
    const platform = detectPlatformFromUrl(url)

    // Платформы с полноразмерным превью
    const hasRichPreview = ['youtube', 'vimeo', 'soundcloud', 'tiktok', 'imgur'].includes(platform)
    const isVideo = platform === 'youtube' || platform === 'vimeo'
    const videoId = isVideo ? extractVideoId(url, platform) : null

    // Создаем wrapper для embed
    const wrapper = document.createElement('div')
    wrapper.className = `embed-wrapper embed-${platform}`
    wrapper.setAttribute('data-embed-platform', platform)
    wrapper.setAttribute('data-embed-url', url)
    wrapper.setAttribute('data-sdk-loaded', 'false')

    if (hasRichPreview) {
      // Получаем thumbnail URL для платформы
      let thumbnailUrl = ''
      let needsAsyncLoad = false

      if (platform === 'youtube' && videoId) {
        thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      } else if (platform === 'vimeo' && videoId) {
        thumbnailUrl = `https://vumbnail.com/${videoId}.jpg`
      } else if (platform === 'imgur') {
        // Извлекаем imgur ID из URL
        const imgurMatch = url.match(/imgur\.com\/(?:gallery\/|a\/)?([a-zA-Z0-9]+)/)
        if (imgurMatch) {
          thumbnailUrl = `https://i.imgur.com/${imgurMatch[1]}l.jpg` // large thumbnail
        }
      } else {
        // Для SoundCloud, TikTok - нужна асинхронная загрузка метаданных
        needsAsyncLoad = true
      }

      // Стиль для rich preview с thumbnail
      wrapper.style.cssText = `
        position: relative;
        border-radius: 8px;
        margin: 16px 0;
        overflow: hidden;
        cursor: pointer;
        background: ${isVideo ? '#000' : '#f9f9f9'};
        min-height: ${needsAsyncLoad ? '200px' : 'auto'};
      `

      if (!needsAsyncLoad && thumbnailUrl) {
        // Создаем thumbnail
        const thumbnail = document.createElement('img')
        thumbnail.src = thumbnailUrl
        thumbnail.alt = `${getPlatformName(platform)} preview`
        thumbnail.style.cssText = `
          width: 100%;
          height: auto;
          display: block;
        `

        // Для видео платформ - добавляем overlay с play кнопкой
        if (isVideo) {
          const overlay = document.createElement('div')
          overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.3);
            transition: background 0.2s;
          `

          const playButton = document.createElement('div')
          playButton.style.cssText = `
            width: 68px;
            height: 48px;
            background: rgba(255, 0, 0, 0.8);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          `
          playButton.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z"/>
            </svg>
          `

          wrapper.addEventListener('mouseenter', () => {
            overlay.style.background = 'rgba(0, 0, 0, 0.5)'
            playButton.style.background = 'rgba(255, 0, 0, 1)'
            playButton.style.transform = 'scale(1.1)'
          })
          wrapper.addEventListener('mouseleave', () => {
            overlay.style.background = 'rgba(0, 0, 0, 0.3)'
            playButton.style.background = 'rgba(255, 0, 0, 0.8)'
            playButton.style.transform = 'scale(1)'
          })

          overlay.appendChild(playButton)
          wrapper.appendChild(thumbnail)
          wrapper.appendChild(overlay)
        } else {
          // Для не-видео (Imgur) - просто thumbnail с легким overlay
          wrapper.appendChild(thumbnail)

          const overlay = document.createElement('div')
          overlay.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 12px;
            background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
            color: white;
            font-size: 14px;
            font-weight: 600;
          `
          overlay.textContent = getPlatformName(platform)
          wrapper.appendChild(overlay)
        }
      } else if (needsAsyncLoad) {
        // Показываем loader и загружаем метаданные асинхронно
        const loader = document.createElement('div')
        loader.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          color: #666;
        `
        loader.textContent = 'Loading preview...'
        wrapper.appendChild(loader)

        // Асинхронная загрузка метаданных
        void (async () => {
          const { getEmbedMetadata, OEMBED_ENDPOINTS } = await import(
            '~/components/SimpleRichEditor/media/embedMetadata'
          )
          const metadata = await getEmbedMetadata(url, platform as keyof typeof OEMBED_ENDPOINTS)

          if (metadata?.thumbnail) {
            loader.remove()
            const thumbnail = document.createElement('img')
            thumbnail.src = metadata.thumbnail
            thumbnail.alt = metadata.title || `${getPlatformName(platform)} preview`
            thumbnail.style.cssText = `
              width: 100%;
              height: auto;
              display: block;
            `
            wrapper.appendChild(thumbnail)

            // Добавляем текстовый overlay внизу
            const overlay = document.createElement('div')
            overlay.style.cssText = `
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              padding: 12px;
              background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
              color: white;
            `

            if (metadata.title) {
              const title = document.createElement('div')
              title.style.cssText = `
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 4px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              `
              title.textContent = metadata.title
              overlay.appendChild(title)
            }

            if (metadata.author) {
              const author = document.createElement('div')
              author.style.cssText = `
                font-size: 12px;
                opacity: 0.9;
              `
              author.textContent = metadata.author
              overlay.appendChild(author)
            }

            wrapper.appendChild(overlay)
          }
        })()
      }
    } else {
      // Стиль для обычных embed (не видео)
      wrapper.style.cssText = `
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 16px;
        margin: 16px 0;
        background: #f9f9f9;
        cursor: pointer;
        transition: background 0.2s;
      `

      // Создаем контейнер для иконки и текста
      const header = document.createElement('div')
      header.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      `

      // Создаем иконку платформы
      const icon = document.createElement('img')
      icon.src = getPlatformIcon(platform)
      icon.alt = `${getPlatformName(platform)} icon`
      icon.style.cssText = `
        width: 24px;
        height: 24px;
        flex-shrink: 0;
      `

      // Создаем текст с названием и ссылкой
      const textContainer = document.createElement('div')
      textContainer.style.cssText = `
        flex: 1;
        overflow: hidden;
      `

      const title = document.createElement('div')
      title.style.cssText = `
        font-size: 14px;
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
      `
      title.textContent = getPlatformName(platform)

      const linkText = document.createElement('div')
      linkText.style.cssText = `
        font-size: 12px;
        color: #666;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `
      linkText.textContent = url

      textContainer.appendChild(title)
      textContainer.appendChild(linkText)
      header.appendChild(icon)
      header.appendChild(textContainer)

      // Создаем кнопку загрузки
      const button = document.createElement('button')
      button.textContent = 'Load content'
      button.style.cssText = `
        background: #007bff;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      `

      wrapper.appendChild(header)
      wrapper.appendChild(button)
    }

    // Создаем контейнер для загруженного контента (скрытый)
    const contentContainer = document.createElement('div')
    contentContainer.style.display = 'none'

    // Обработчик загрузки
    const loadContent = async () => {
      // Для YouTube/Vimeo - создаем iframe напрямую
      if (platform === 'youtube' || platform === 'vimeo') {
        const videoId = extractVideoId(url, platform)
        if (videoId) {
          const iframe = createVideoIframe(videoId, platform === 'vimeo')
          contentContainer.appendChild(iframe)
          contentContainer.style.display = 'block'
          wrapper.style.display = 'none'
        }
      } else {
        // Для остальных платформ - динамический импорт
        const { createUniversalEmbed } = await import('~/components/SimpleRichEditor/media/html')
        const { initializeEmbedLazy } = await import('~/components/SimpleRichEditor/media/embedLoader')

        const embedHtml = await createUniversalEmbed(url, platform)

        if (embedHtml) {
          contentContainer.innerHTML = embedHtml
          contentContainer.style.display = 'block'
          wrapper.style.display = 'none'

          // Инициализируем lazy loading для социальных сетей если нужно
          const lazyWrapper = contentContainer.querySelector('.embed-lazy') as HTMLElement
          if (lazyWrapper && platform !== 'unknown') {
            await initializeEmbedLazy(lazyWrapper, platform as EmbedPlatform)
          }
        }
      }
    }

    // Для rich preview - клик на весь wrapper, для остальных - на кнопку
    if (hasRichPreview) {
      wrapper.addEventListener('click', (e) => {
        e.preventDefault()
        void loadContent()
      })
    } else {
      const button = wrapper.querySelector('button')
      if (button) {
        button.addEventListener('click', async (e) => {
          e.stopPropagation()
          button.disabled = true
          button.textContent = 'Loading...'
          await loadContent()
        })
      }
    }

    // Заменяем embed на wrapper
    embed.replaceWith(wrapper)
    wrapper.after(contentContainer)
  }
}

function getPlatformIcon(platform: string): string {
  // Возвращаем путь к SVG иконке
  const icons: Record<string, string> = {
    youtube: '/icons/social-youtube.svg',
    vimeo: '/icons/social-vimeo.svg',
    soundcloud: '/icons/social-soundcloud.svg',
    bandcamp: '/icons/audio.svg',
    facebook: '/icons/social-facebook.svg',
    x: '/icons/social-x.svg',
    instagram: '/icons/social-instagram.svg',
    telegram: '/icons/social-telegram.svg',
    reddit: '/icons/social-reddit.svg',
    tiktok: '/icons/user-link-tiktok.svg',
    twitch: '/icons/editor-video.svg',
    ted: '/icons/editor-video.svg',
    wikipedia: '/icons/editor-tooltip.svg',
    slideshare: '/icons/article.svg',
    imgur: '/icons/editor-image.svg',
    flickr: '/icons/editor-image.svg',
    discours: '/icons/logo.svg'
  }
  return icons[platform] || '/icons/editor-link.svg'
}

function getPlatformName(platform: string): string {
  const names: Record<string, string> = {
    youtube: 'YouTube',
    vimeo: 'Vimeo',
    soundcloud: 'SoundCloud',
    bandcamp: 'Bandcamp',
    facebook: 'Facebook',
    x: 'X (Twitter)',
    instagram: 'Instagram',
    telegram: 'Telegram',
    reddit: 'Reddit',
    tiktok: 'TikTok',
    twitch: 'Twitch',
    ted: 'TED',
    wikipedia: 'Wikipedia',
    slideshare: 'SlideShare',
    imgur: 'Imgur',
    flickr: 'Flickr',
    discours: 'Discours'
  }
  return names[platform] || platform
}

/**
 * Создает responsive iframe wrapper для видео
 */
function createVideoIframe(videoId: string, isVimeo: boolean): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'video-player-wrapper'
  wrapper.style.cssText = `
    position: relative;
    padding-bottom: 56.25%;
    height: 0;
    overflow: hidden;
    max-width: 100%;
    margin: 16px 0;
  `

  const iframe = document.createElement('iframe')
  iframe.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  `

  if (isVimeo) {
    iframe.src = `https://player.vimeo.com/video/${videoId}`
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture')
  } else {
    iframe.src = `https://www.youtube.com/embed/${videoId}`
  }

  iframe.setAttribute('allowfullscreen', 'true')
  iframe.setAttribute('loading', 'lazy')

  wrapper.appendChild(iframe)
  return wrapper
}

/**
 * Извлекает video ID из URL
 * Поддерживает YouTube (watch?v= и youtu.be/) и Vimeo
 */
function extractVideoId(url: string, platform: 'youtube' | 'vimeo'): string | null {
  if (platform === 'vimeo') {
    const match = url.match(/vimeo\.com\/(\d+)/)
    return match?.[1] || null
  }

  // YouTube
  if (url.includes('youtube.com')) {
    const match = url.match(/watch\?v=([a-zA-Z0-9_-]{11})/)
    return match?.[1] || null
  }
  if (url.includes('youtu.be')) {
    const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
    return match?.[1] || null
  }

  return null
}

/**
 * Обрабатывает все кастомные теги в контейнере
 *
 * Поддерживаемые теги:
 * - <tooltip>: интерактивные тултипы
 * - <embed>: универсальные embed для всех 17 платформ
 */
export const processCustomTags = async (container: HTMLElement) => {
  if (!container) return

  // Обрабатываем тултипы
  processTooltips(container)

  // Обрабатываем embed (включая YouTube/Vimeo)
  await processEmbeds(container)
}

/**
 * Инициализирует обработку кастомных тегов для элемента
 * Используется в компонентах после рендеринга innerHTML
 */
export const initCustomTags = (elementOrRef: HTMLElement | (() => HTMLElement | undefined)) => {
  // ✅ КРИТИЧНО: Проверка SSR - не манипулируем DOM на сервере
  if (typeof window === 'undefined') {
    return
  }

  const element = typeof elementOrRef === 'function' ? elementOrRef() : elementOrRef

  if (!element) {
    console.warn('[customTags] Element not found for custom tags initialization')
    return
  }

  // ✅ КРИТИЧНО: Используем requestAnimationFrame вместо setTimeout
  // для лучшей синхронизации с браузером и избежания гидрационных мисматчей
  requestAnimationFrame(() => {
    void processCustomTags(element)
  })
}
