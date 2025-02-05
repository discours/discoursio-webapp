import styles from './embed.module.scss'

// Добавляем регулярное выражение на верхний уровень
export const IMAGE_REGEX = /\.(jpe?g|png|gif|webp|avif)$/i
export const VIMEO_REGEX = /^(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d+)$/
export const YOUTUBE_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})$/
export const URL_REGEX = /^(https?:\/\/)?(www\.)?[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/
export const AUDIO_REGEX = /\.(mp3|wav|ogg|m4a)$/i

export interface EmbedContent {
  type: 'link' | 'image' | 'video' | 'audio'
  url: string
  title?: string
  description?: string
  image?: string
  videoId?: string
  width?: number
  height?: number
}

export interface EmbedOptions {
  showLoading?: () => void
  insertText: (text: string) => void
  insertHtml: (html: string) => void
  skipRecognition?: boolean
}

/**
 * Normalizes URL by adding protocol if missing
 */
export const normalizeUrl = (url: string): string => {
  if (!url) return url
  return url.startsWith('http') ? url : `https://${url}`
}

/**
 * Creates HTML element with given attributes
 */
const createElement = (tag: string, attrs: Record<string, string> = {}) => {
  const el = document.createElement(tag)
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value)
  })
  return el
}

/**
 * Selected text into the link
 * @param url - Link URL
 * @param text - Link text
 * @returns HTML string for embedding
 */
export const selectedTextToLink = (url: string, text?: string) => {
  const normalized = normalizeUrl(url)
  const link = createElement('a', { href: normalized })
  link.textContent = text || normalized
  return link.outerHTML
}

/**
 * Selected text into the image
 * @param url - Link URL
 * @param text - Link text
 * @returns HTML string for embedding
 */
export const selectedTextToImage = (url: string, text?: string) => {
  const img = createElement('img', {
    src: url,
    alt: text || ''
  })
  return img.outerHTML
}

/**
 * Selected text into the image
 * @param url - Link URL
 * @param text - Link text
 * @returns HTML string for embedding
 */
export const selectedTextToVideo = (url: string) => {
  if (!url) return url
  const selection = window.getSelection()
  if (!selection) return url
  const range = selection.getRangeAt(0)
  range.deleteContents()

  return patchVideo(url)
}

/**
 * Patches a video into the text
 * @param url - Video URL
 * @returns HTML string for embedding
 */
export const patchVideo = (url: string) => {
  const youtubeMatch = url.match(YOUTUBE_REGEX)
  const vimeoMatch = url.match(VIMEO_REGEX)
  const videoId = youtubeMatch?.[1] || vimeoMatch?.[1]
  return youtubeMatch
    ? `
  <iframe 
      src="https://www.youtube.com/embed/${videoId}"
      width="100%"
      height="100%"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
    ></iframe>
  `
    : vimeoMatch
      ? `
  <iframe 
    src="https://player.vimeo.com/video/${videoId}"
    width="100%"
    height="100%"
    frameborder="0"
    allow="autoplay; fullscreen; picture-in-picture"
    allowfullscreen
  ></iframe>
  `
      : ''
}

/**
 * Creates HTML for embedding different types of content
 * @param content - Recognized content from URL
 * @returns HTML string for embedding
 */
export const createEmbedHtml = (content: EmbedContent): string => {
  switch (content.type) {
    case 'video': {
      return `
        <div class="${styles['video-embed']}">
          ${patchVideo(content.url)}
        </div>
      `
    }
    case 'image': {
      return `
        <figure>
          <img 
            src="${content.url}" 
            alt="${content.title || ''}"
            ${content.width ? `width="${content.width}"` : ''}
            ${content.height ? `height="${content.height}"` : ''}
          />
          ${content.title ? `<figcaption>${content.title}</figcaption>` : ''}
        </figure>`
    }
    case 'audio': {
      return `
        <audio controls>
          <source src="${content.url}" type="audio/${content.url.split('.').pop()}">
          ${'Your browser does not support the audio element.'}
        </audio>`
    }
    case 'link': {
      return `
        <div class="${styles.preview}">
          ${content.image ? `<img src="${content.image}" alt="${content.title || ''}" />` : ''}
          <div class="${styles.previewContent}">
            <a href="${content.url}" target="_blank" rel="noopener noreferrer">
              ${content.title || content.url}
            </a>
            ${content.description ? `<p>${content.description}</p>` : ''}
          </div>
        </div>`
    }
    default: {
      return ''
    }
  }
}

export const recognizeContent = async (text: string): Promise<EmbedContent | undefined> => {
  const regexes = [IMAGE_REGEX, VIMEO_REGEX, YOUTUBE_REGEX, URL_REGEX, AUDIO_REGEX]
  const regex = regexes.find((regex) => regex.test(text))
  if (!regex) return

  const matchedUrl = text.match(regex)?.[0]
  if (matchedUrl) {
    // использовать matchedUrl
  }
}

/**
 * Handles pasting content with URL recognition
 * @param text - Pasted text
 * @param options - Handler options
 * @returns Promise resolving to HTML string or null
 */
export const handleContentPaste = async (
  text: string,
  options: {
    showLoading?: () => void
    insertText: (text: string) => void
    insertHtml: (html: string) => void
  }
): Promise<void> => {
  const { showLoading, insertText, insertHtml } = options

  try {
    insertText(new URL(text).toString())
    showLoading?.()

    const content = await recognizeContent(text)
    if (!content) {
      insertText(text)
      return
    }

    const html = createEmbedHtml(content)
    if (html) {
      insertHtml(html)
    } else {
      insertText(text)
    }
  } catch {
    insertText(text)
  }
}
