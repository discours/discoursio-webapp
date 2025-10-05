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
 * Конфигурация платформ для embed
 */
const PLATFORM_CONFIG = {
  youtube: { domains: ['youtube.com', 'youtu.be'], type: 'video' },
  vimeo: { domains: ['vimeo.com'], type: 'video' },
  soundcloud: { domains: ['soundcloud.com'], type: 'audio' },
  bandcamp: { domains: ['bandcamp.com'], type: 'audio' },
  facebook: { domains: ['facebook.com'], type: 'social' },
  x: { domains: ['twitter.com', 'x.com'], type: 'social' },
  instagram: { domains: ['instagram.com'], type: 'social' },
  telegram: { domains: ['t.me'], type: 'social' },
  reddit: { domains: ['reddit.com'], type: 'social' },
  tiktok: { domains: ['tiktok.com'], type: 'video' },
  twitch: { domains: ['twitch.tv'], type: 'video' },
  ted: { domains: ['ted.com'], type: 'video' },
  wikipedia: { domains: ['wikipedia.org'], type: 'reference' },
  slideshare: { domains: ['slideshare.net'], type: 'presentation' },
  imgur: { domains: ['imgur.com'], type: 'image' },
  flickr: { domains: ['flickr.com'], type: 'image' },
  discours: { domains: ['discours.io'], type: 'article' },
  'yandex-music': { domains: ['music.yandex.ru', 'music.yandex.com'], type: 'audio' },
  knightlab: { domains: ['cdn.knightlab.com'], type: 'interactive' },
  apester: { domains: ['renderer.apester.com'], type: 'interactive' },
  interacty: { domains: ['p.interacty.me'], type: 'interactive' },
  ok: { domains: ['ok.ru'], type: 'social' },
  vk: { domains: ['vk.com', 'vkvideo.ru'], type: 'social' },
  piktochart: { domains: ['create.piktochart.com'], type: 'infographic' },
  bitchute: { domains: ['bitchute.com'], type: 'video' },
  coub: { domains: ['coub.com'], type: 'video' },
  rutube: { domains: ['rutube.ru'], type: 'video' },
  'google-maps': { domains: ['google.com/maps/embed', 'maps.google.com'], type: 'map' },
  'yandex-maps': { domains: ['yandex.ru/map', 'yandex.com/map', 'api-maps.yandex.ru'], type: 'map' },
  umap: { domains: ['umap.openstreetmap.fr', 'umap.openstreetmap.de'], type: 'map' },
  openfreemap: { domains: ['openfreemap.org'], type: 'map' },
  pubhtml5: { domains: ['pubhtml5.com'], type: 'interactive' },
  spotify: { domains: ['spotify.com/episode', 'anchor.fm'], type: 'audio' }
} as const

/**
 * Определяет платформу по URL
 */
function detectPlatformFromUrl(url: string): string {
  for (const [platform, config] of Object.entries(PLATFORM_CONFIG)) {
    if (config.domains.some((domain) => url.includes(domain))) {
      return platform
    }
  }
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

    // Определяем тип контента по конфигурации
    const platformType = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.type
    const hasRichPreview = ['youtube', 'vimeo', 'soundcloud', 'tiktok', 'imgur', 'yandex-music'].includes(platform)
    const isVideo = platformType === 'video'
    const isAudio = platformType === 'audio'
    const videoId = isVideo && platform !== 'tiktok' ? extractVideoId(url, platform) : null

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
        background: ${isVideo ? '#000' : isAudio ? '#f5f5f5' : '#f9f9f9'};
        min-height: ${needsAsyncLoad ? '200px' : isAudio ? '166px' : 'auto'};
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
      // Для видео/аудио/карт платформ с прямым iframe - создаем напрямую
      const directIframePlatforms = [
        'youtube',
        'vimeo',
        'rutube',
        'coub',
        'bitchute',
        'yandex-music',
        'google-maps',
        'yandex-maps',
        'umap',
        'openfreemap',
        'pubhtml5'
      ] as const
      if (directIframePlatforms.includes(platform as (typeof directIframePlatforms)[number])) {
        const videoId = extractVideoId(url, platform)
        if (
          videoId ||
          platform === 'yandex-music' ||
          platform === 'google-maps' ||
          platform === 'yandex-maps' ||
          platform === 'umap' ||
          platform === 'openfreemap' ||
          platform === 'pubhtml5'
        ) {
          const iframe = createMediaIframe(
            url,
            platform as
              | 'youtube'
              | 'vimeo'
              | 'rutube'
              | 'coub'
              | 'bitchute'
              | 'yandex-music'
              | 'google-maps'
              | 'yandex-maps'
          )
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

/**
 * Метаданные платформ для UI
 */
const PLATFORM_METADATA: Record<string, { name: string; icon: string }> = {
  youtube: { name: 'YouTube', icon: '/icons/social-youtube.svg' },
  vimeo: { name: 'Vimeo', icon: '/icons/social-vimeo.svg' },
  soundcloud: { name: 'SoundCloud', icon: '/icons/social-soundcloud.svg' },
  bandcamp: { name: 'Bandcamp', icon: '/icons/audio.svg' },
  facebook: { name: 'Facebook', icon: '/icons/social-facebook.svg' },
  x: { name: 'X (Twitter)', icon: '/icons/social-x.svg' },
  instagram: { name: 'Instagram', icon: '/icons/social-instagram.svg' },
  telegram: { name: 'Telegram', icon: '/icons/social-telegram.svg' },
  reddit: { name: 'Reddit', icon: '/icons/social-reddit.svg' },
  tiktok: { name: 'TikTok', icon: '/icons/user-link-tiktok.svg' },
  twitch: { name: 'Twitch', icon: '/icons/editor-video.svg' },
  ted: { name: 'TED', icon: '/icons/editor-video.svg' },
  wikipedia: { name: 'Wikipedia', icon: '/icons/editor-tooltip.svg' },
  slideshare: { name: 'SlideShare', icon: '/icons/article.svg' },
  imgur: { name: 'Imgur', icon: '/icons/editor-image.svg' },
  flickr: { name: 'Flickr', icon: '/icons/editor-image.svg' },
  discours: { name: 'Discours', icon: '/icons/logo.svg' },
  'yandex-music': { name: 'Яндекс.Музыка', icon: '/icons/audio.svg' },
  knightlab: { name: 'KnightLab', icon: '/icons/article.svg' },
  apester: { name: 'Apester', icon: '/icons/editor-quiz.svg' },
  interacty: { name: 'Interacty', icon: '/icons/editor-quiz.svg' },
  ok: { name: 'Одноклассники', icon: '/icons/editor-video.svg' },
  vk: { name: 'ВКонтакте', icon: '/icons/social-vk.svg' }, // 🗣️ https://dev.vk.com/ru/guide
  piktochart: { name: 'Piktochart', icon: '/icons/editor-image.svg' },
  bitchute: { name: 'BitChute', icon: '/icons/editor-video.svg' },
  coub: { name: 'Coub', icon: '/icons/editor-video.svg' },
  rutube: { name: 'Rutube', icon: '/icons/editor-video.svg' },
  'google-maps': { name: 'Google Maps', icon: '/icons/editor-location.svg' },
  'yandex-maps': { name: 'Яндекс.Карты', icon: '/icons/editor-location.svg' },
  umap: { name: 'uMap (OpenStreetMap)', icon: '/icons/editor-location.svg' },
  openfreemap: { name: 'OpenFreeMap', icon: '/icons/editor-location.svg' },
  pubhtml5: { name: 'PubHTML5 Flipbook', icon: '/icons/article.svg' },
  spotify: { name: 'Spotify/Anchor (требует регистрацию)', icon: '/icons/audio.svg' }
}

function getPlatformIcon(platform: string): string {
  return PLATFORM_METADATA[platform]?.icon || '/icons/editor-link.svg'
}

function getPlatformName(platform: string): string {
  return PLATFORM_METADATA[platform]?.name || platform
}

/**
 * Создает responsive iframe wrapper для видео, аудио и карт
 */
function createMediaIframe(
  url: string,
  platform:
    | 'youtube'
    | 'vimeo'
    | 'rutube'
    | 'coub'
    | 'bitchute'
    | 'yandex-music'
    | 'google-maps'
    | 'yandex-maps'
    | 'umap'
    | 'openfreemap'
    | 'pubhtml5'
): HTMLElement {
  const wrapper = document.createElement('div')
  const isAudio = platform === 'yandex-music'
  const isMap =
    platform === 'google-maps' || platform === 'yandex-maps' || platform === 'umap' || platform === 'openfreemap'
  const isFlipbook = platform === 'pubhtml5'

  if (isAudio) {
    wrapper.className = 'audio-player-wrapper'
  } else if (isMap) {
    wrapper.className = 'map-wrapper'
  } else if (isFlipbook) {
    wrapper.className = 'flipbook-wrapper'
  } else {
    wrapper.className = 'video-player-wrapper'
  }

  // ✅ Разные стили для видео, аудио и карт
  if (isAudio) {
    // Для аудио - фиксированная высота 166px
    wrapper.style.cssText = `
      position: relative;
      height: 166px;
      overflow: hidden;
      max-width: 100%;
      margin: 16px 0;
      border-radius: 8px;
    `
  } else if (isMap) {
    // Для карт - фиксированная высота 450px (стандарт Google/Yandex)
    wrapper.style.cssText = `
      position: relative;
      height: 450px;
      overflow: hidden;
      max-width: 100%;
      margin: 16px 0;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    `
  } else if (isFlipbook) {
    // Для флипбуков (PubHTML5) - высота 600px для комфортного чтения
    wrapper.style.cssText = `
      position: relative;
      height: 600px;
      overflow: hidden;
      max-width: 100%;
      margin: 16px 0;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    `
  } else {
    // Для видео - responsive 16:9
    wrapper.style.cssText = `
      position: relative;
      padding-bottom: 56.25%;
      height: 0;
      overflow: hidden;
      max-width: 100%;
      margin: 16px 0;
    `
  }

  const iframe = document.createElement('iframe')
  iframe.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  `

  // ✅ Конфигурация iframe для платформ (проверено по официальным документациям)
  const iframeConfig: Record<string, { getSrc: (url: string) => string; allow?: string }> = {
    youtube: {
      // 🗣️ YouTube IFrame Player API: https://developers.google.com/youtube/iframe_api_reference
      getSrc: (url) => `https://www.youtube.com/embed/${extractVideoId(url, 'youtube')}`,
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
    },
    vimeo: {
      // 🗣️ Vimeo Player SDK: https://developer.vimeo.com/player/sdk
      getSrc: (url) => `https://player.vimeo.com/video/${extractVideoId(url, 'vimeo')}`,
      allow: 'autoplay; fullscreen; picture-in-picture; encrypted-media'
    },
    rutube: {
      // 🗣️ Rutube: проверено по фактическим embed URL
      getSrc: (url) => `https://rutube.ru/play/embed/${extractVideoId(url, 'rutube')}`,
      allow: 'clipboard-write; autoplay; encrypted-media; fullscreen'
    },
    coub: {
      // 🗣️ Coub: проверено по фактическим embed URL
      getSrc: (url) => `https://coub.com/embed/${extractVideoId(url, 'coub')}`,
      allow: 'autoplay; encrypted-media'
    },
    bitchute: {
      // 🗣️ BitChute: проверено по фактическим embed URL
      getSrc: (url) => `https://www.bitchute.com/embed/${extractVideoId(url, 'bitchute')}/`,
      allow: 'fullscreen; encrypted-media'
    },
    'yandex-music': {
      // 🗣️ Яндекс.Музыка: официальный формат iframe виджета
      // Поддерживает: /iframe/#track/{TRACK_ID}/{ALBUM_ID}/
      getSrc: (url) => {
        const match = url.match(/album\/(\d+)\/track\/(\d+)/)
        if (match) {
          const [, albumId, trackId] = match
          return `https://music.yandex.ru/iframe/#track/${trackId}/${albumId}/`
        }
        return ''
      },
      allow: 'autoplay; encrypted-media; fullscreen'
    },
    'google-maps': {
      // 🗣️ Google Maps Embed API
      // Формат: https://www.google.com/maps/embed?pb=...
      getSrc: (url) => url, // URL уже в правильном формате
      allow: 'fullscreen'
    },
    'yandex-maps': {
      // 🗣️ Яндекс.Карты Widget API
      // Формат: https://yandex.ru/map-widget/v1/?...
      getSrc: (url) => url, // URL уже в правильном формате
      allow: 'fullscreen'
    },
    umap: {
      // 🗣️ uMap (OpenStreetMap): https://umap.openstreetmap.fr
      // Формат: https://umap.openstreetmap.fr/.../map/...
      getSrc: (url) => url, // URL уже в правильном формате
      allow: 'fullscreen'
    },
    openfreemap: {
      // 🗣️ OpenFreeMap: https://openfreemap.org
      getSrc: (url) => url, // URL уже в правильном формате
      allow: 'fullscreen'
    },
    pubhtml5: {
      // 🗣️ PubHTML5: интерактивные флипбуки (digital magazines)
      // Формат: https://s3.amazonaws.com/online.pubhtml5.com/.../index.html
      getSrc: (url) => url, // URL уже в правильном формате
      allow: 'fullscreen'
    }
  }

  const config = iframeConfig[platform]
  if (config) {
    iframe.src = config.getSrc(url)
    if (config.allow) {
      iframe.setAttribute('allow', config.allow)
    }
  }

  iframe.setAttribute('allowfullscreen', 'true')
  iframe.setAttribute('loading', 'lazy')
  iframe.setAttribute('frameborder', '0')

  wrapper.appendChild(iframe)
  return wrapper
}

/**
 * Типы платформ поддерживающих извлечение video ID
 */
type VideoIdPlatform = 'youtube' | 'vimeo' | 'rutube' | 'coub' | 'bitchute'

/**
 * Паттерны для извлечения video ID из разных платформ
 */
const VIDEO_ID_PATTERNS: Record<VideoIdPlatform, RegExp | RegExp[]> = {
  youtube: [/watch\?v=([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/],
  vimeo: /vimeo\.com\/(\d+)/,
  rutube: /rutube\.ru\/video\/([a-f0-9]+)/,
  coub: /coub\.com\/(?:view|embed)\/([a-zA-Z0-9]+)/,
  bitchute: /bitchute\.com\/(?:video|embed)\/([a-zA-Z0-9]+)/
}

/**
 * Извлекает video ID из URL
 * Поддерживает множество платформ
 */
function extractVideoId(url: string, platform: string): string | null {
  // Type guard для проверки поддерживаемой платформы
  if (!(platform in VIDEO_ID_PATTERNS)) return null

  const patterns = VIDEO_ID_PATTERNS[platform as VideoIdPlatform]
  if (!patterns) return null

  // Обрабатываем как массив паттернов, так и одиночный паттерн
  const patternArray = Array.isArray(patterns) ? patterns : [patterns]

  for (const pattern of patternArray) {
    const match = url.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
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
