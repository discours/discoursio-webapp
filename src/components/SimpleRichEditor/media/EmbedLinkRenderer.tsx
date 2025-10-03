/**
 * @module media/EmbedLinkRenderer
 * @description Компонент для рендеринга компактных <embed-link> тегов
 */

import { createResource, onMount } from 'solid-js'
import { isServer } from 'solid-js/web'
import { initializeEmbedLazy } from './embedLoader'
import { type EmbedMetadata, getEmbedMetadata } from './embedMetadata'
import type { EmbedPlatform } from './types'

interface EmbedLinkProps {
  platform: EmbedPlatform
  url: string
  metadata?: string // JSON-stringified EmbedMetadata
  lang?: string
}

/**
 * Компонент для рендеринга <embed-link> элементов
 * Автоматически создает соответствующий embed на основе платформы
 */
export const EmbedLinkRenderer = (props: EmbedLinkProps) => {
  let containerRef: HTMLDivElement | undefined

  // Парсим метаданные если они есть
  const parsedMetadata = (): EmbedMetadata | undefined => {
    if (!props.metadata) return undefined
    try {
      return JSON.parse(props.metadata)
    } catch {
      return undefined
    }
  }

  // Загружаем метаданные если их нет
  const [metadata] = createResource(
    () => ({ url: props.url, existing: parsedMetadata() }),
    async ({ url, existing }) => {
      if (existing) return existing
      return await getEmbedMetadata(url)
    },
    { initialValue: parsedMetadata() }
  )

  // Создаем embed после монтирования
  onMount(async () => {
    if (!containerRef) return

    const { createUniversalEmbed } = await import('./html')

    // Создаем HTML для embed
    const metadataValue = metadata()
    const embedHtml = await createUniversalEmbed(props.url, props.platform, metadataValue || undefined)

    // Вставляем в контейнер
    if (embedHtml) {
      containerRef.innerHTML = embedHtml

      // Инициализируем lazy loading для социальных сетей
      if (!isServer) {
        const lazyWrapper = containerRef.querySelector('.embed-lazy') as HTMLElement
        if (lazyWrapper && props.platform !== 'unknown') {
          await initializeEmbedLazy(lazyWrapper, props.platform)
        }
      }
    }
  })

  return <div ref={containerRef} class="embed-link-container" data-platform={props.platform} data-url={props.url} />
}

/**
 * Utility функция для замены <embed-link> элементов на компоненты
 * Используется при рендеринге HTML контента
 */
export const renderEmbedLinks = (container: HTMLElement) => {
  if (isServer) return

  const embedLinks = container.querySelectorAll('embed-link')

  embedLinks.forEach((embedLink) => {
    const platform = embedLink.getAttribute('data-platform') as EmbedPlatform
    const url = embedLink.getAttribute('data-url')
    const metadata = embedLink.getAttribute('data-metadata')
    const lang = embedLink.getAttribute('data-lang')

    if (!platform || !url) {
      console.warn('EmbedLink missing required attributes:', embedLink)
      return
    }

    // Создаем wrapper div для рендеринга
    const wrapper = document.createElement('div')
    wrapper.className = 'embed-link-wrapper'

    // Заменяем embed-link на wrapper
    embedLink.replaceWith(wrapper)

    // Рендерим компонент (без Solid - используем прямое создание HTML)
    void renderEmbedLinkDirect(wrapper, { platform, url, metadata: metadata || undefined, lang: lang || undefined })
  })
}

/**
 * Прямой рендеринг embed без Solid (для использования в HTML контенте)
 */
async function renderEmbedLinkDirect(container: HTMLElement, props: EmbedLinkProps) {
  const { createUniversalEmbed } = await import('./html')

  // Парсим метаданные
  let metadata: EmbedMetadata | undefined
  if (props.metadata) {
    try {
      metadata = JSON.parse(props.metadata)
    } catch {
      // Fallback: загружаем метаданные
      const fetchedMetadata = await getEmbedMetadata(props.url)
      metadata = fetchedMetadata || undefined
    }
  }

  // Создаем HTML
  const embedHtml = await createUniversalEmbed(props.url, props.platform, metadata)

  if (embedHtml) {
    container.innerHTML = embedHtml

    // Инициализируем lazy loading
    const lazyWrapper = container.querySelector('.embed-lazy') as HTMLElement
    if (lazyWrapper && props.platform !== 'unknown') {
      void initializeEmbedLazy(lazyWrapper, props.platform)
    }
  }
}
