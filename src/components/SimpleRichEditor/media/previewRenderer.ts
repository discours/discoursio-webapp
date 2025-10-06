/**
 * Обработка <preview> тегов в редакторе
 * Заменяет компактные <preview>url</preview> на полноценные iframe для отображения
 */

import { detectVideoPlatform, extractVideoId } from './validation'

/**
 * Обрабатывает все <preview> теги в контейнере и заменяет их на iframe
 * @param container Контейнер с HTML контентом
 */
export const processPreviewTags = async (container: HTMLElement): Promise<void> => {
  const previewTags = container.querySelectorAll('preview')
  console.log('[processPreviewTags] Found preview tags:', previewTags.length)

  for (const previewTag of Array.from(previewTags)) {
    const url = previewTag.textContent?.trim()
    console.log('[processPreviewTags] Processing preview tag with URL:', url)
    if (!url) continue

    // Определяем платформу
    const platform = detectVideoPlatform(url)
    console.log('[processPreviewTags] Detected platform:', platform)

    if (platform && (platform === 'youtube' || platform === 'vimeo')) {
      const videoId = extractVideoId(url)
      console.log('[processPreviewTags] Extracted video ID:', videoId)
      if (videoId) {
        // Создаем wrapper для iframe
        const wrapper = document.createElement('div')
        wrapper.className = 'video-embed-wrapper'
        wrapper.contentEditable = 'false'
        wrapper.style.position = 'relative'
        wrapper.style.paddingBottom = '56.25%'
        wrapper.style.height = '0'
        wrapper.style.margin = '16px 0'

        const iframe = document.createElement('iframe')
        iframe.style.position = 'absolute'
        iframe.style.top = '0'
        iframe.style.left = '0'
        iframe.style.width = '100%'
        iframe.style.height = '100%'
        iframe.setAttribute('frameborder', '0')
        iframe.setAttribute('allowfullscreen', '')
        iframe.setAttribute(
          'allow',
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
        )

        if (platform === 'youtube') {
          iframe.src = `https://www.youtube.com/embed/${videoId}`
        } else {
          iframe.src = `https://player.vimeo.com/video/${videoId}`
        }

        wrapper.appendChild(iframe)

        // Сохраняем оригинальный URL как data-атрибут для последующего сохранения
        wrapper.setAttribute('data-embed-url', url)
        wrapper.setAttribute('data-embed-platform', platform)

        console.log('[processPreviewTags] Replacing preview tag with iframe wrapper')
        previewTag.replaceWith(wrapper)
      }
    }
  }
}

/**
 * Конвертирует iframe обратно в <preview> тег для сохранения
 * @param container Контейнер с HTML контентом
 */
export const convertIframesToPreviews = (container: HTMLElement): void => {
  const wrappers = container.querySelectorAll('.video-embed-wrapper[data-embed-url]')

  for (const wrapper of Array.from(wrappers)) {
    const url = wrapper.getAttribute('data-embed-url')
    if (url) {
      const previewTag = document.createElement('preview')
      previewTag.textContent = url
      wrapper.replaceWith(previewTag)
    }
  }
}
