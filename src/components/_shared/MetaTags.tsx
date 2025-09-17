import { createEffect, createMemo, on } from 'solid-js'
import { isServer } from 'solid-js/web'
import { useLocalize } from '~/context/localize'
import { Author, Shout, Topic } from '~/graphql/generated/graphql'
import { getPageKeywords } from '~/intl/keywords'
import { generatePageSpecificOGMetadata, getPageType } from '~/lib/openGraph'
import { generateServerMetaTags } from '~/lib/serverMetaTags'

type MetaTagsProps = {
  content?: Shout | Author | Topic
  pathname: string
  title: string
  description?: string
  keywords?: string
  featuredArticles?: Shout[]
}

/**
 * Единый компонент для генерации всех метатегов
 */
export const MetaTags = (props: MetaTagsProps) => { 
  const { t, lang } = useLocalize()

  // Определяем контент для генерации метаданных
  const content = () => props.content

  // Генерируем OG метаданные
  const ogMetadata = createMemo(() => {
    const pageType = getPageType(props.pathname)

    return generatePageSpecificOGMetadata(pageType, content(), {
      pathname: props.pathname,
      defaultTitle: props.title,
      defaultDescription: props.description,
      locale: lang(),
      featuredArticles: props.featuredArticles
    })
  })

  // Генерируем ключевые слова
  const keywords = createMemo(() => {
    if (props.keywords) return props.keywords

    const contentInfo = {
      type:
        props.content && 'title' in props.content && 'body' in props.content
          ? 'article'
          : props.content && 'name' in props.content
            ? 'author'
            : props.content && 'title' in props.content
              ? 'topic'
              : 'website',
      data: props.content || null
    }

    return getPageKeywords(contentInfo, props.pathname, lang())
  })

  // Обновляем метатеги на клиенте
  createEffect(
    on([ogMetadata, keywords], ([ogData, keywords]) => {
      if (isServer) return // На сервере только SSR

      try {
        // Обновляем title
        if (document.title !== ogData.title) {
          document.title = ogData.title
        }

        // Функция для обновления/создания метатега
        const updateMetaTag = (selector: string, content: string) => {
          let meta = document.querySelector(selector)
          if (!meta) {
            meta = document.createElement('meta')

            // Определяем атрибут по селектору
            if (selector.includes('property=')) {
              const property = selector.match(/property="([^"]+)"/)?.[1]
              if (property) meta.setAttribute('property', property)
            } else if (selector.includes('name=')) {
              const name = selector.match(/name="([^"]+)"/)?.[1]
              if (name) meta.setAttribute('name', name)
            }

            document.head.appendChild(meta)
          }
          meta.setAttribute('content', content)
        }

        // Обновляем базовые метатеги
        updateMetaTag('meta[name="description"]', ogData.description)
        updateMetaTag('meta[name="keywords"]', keywords)

        // Обновляем OG теги
        updateMetaTag('meta[property="og:type"]', ogData.type)
        updateMetaTag('meta[property="og:title"]', ogData.title)
        updateMetaTag('meta[property="og:description"]', ogData.description)
        updateMetaTag('meta[property="og:url"]', ogData.url)
        updateMetaTag('meta[property="og:image"]', ogData.image)
        updateMetaTag('meta[property="og:locale"]', ogData.locale)

        // Обновляем Twitter Card теги
        updateMetaTag('meta[name="twitter:title"]', ogData.title)
        updateMetaTag('meta[name="twitter:description"]', ogData.description)
        updateMetaTag('meta[name="twitter:image"]', ogData.image)

        // Обновляем canonical URL
        let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
        if (!canonical) {
          canonical = document.createElement('link')
          canonical.rel = 'canonical'
          document.head.appendChild(canonical)
        }
        canonical.href = ogData.canonicalUrl || ogData.url
      } catch (error) {
        console.error('[MetaTags] Error updating meta tags:', error)
      }
    })
  )

  // На сервере генерируем HTML метатеги
  if (isServer) {
    return (
      <div
        innerHTML={generateServerMetaTags(content(), {
          pathname: props.pathname,
          defaultTitle: props.title,
          defaultDescription: props.description,
          locale: lang(),
          t: t
        })}
      />
    )
  }

  // На клиенте возвращаем пустой div (метатеги обновляются через DOM API)
  return <div style={{ display: 'none' }} />
}
