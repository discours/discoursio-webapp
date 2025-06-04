import { Meta, Title } from '@solidjs/meta'
import { useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import type { JSX } from 'solid-js'
import { Show, createEffect, createMemo, createSignal, onMount } from 'solid-js'
import { cdnUrl } from '~/config'
import { useLocalize } from '~/context/localize'
import { getShout } from '~/graphql/api/public'
import { Author, Shout, Topic } from '~/graphql/schema/core.gen'
import enKeywords from '~/intl/locales/en/keywords.json'
import ruKeywords from '~/intl/locales/ru/keywords.json'
import { getFileUrl } from '~/lib/getThumbUrl'
import { OG_BASIC_URL, getArticleOGImage, getAuthorOGImage, getTopicOGImage } from '~/lib/ogImages'
import { descFromBody } from '~/utils/meta'
import { FooterView } from '../Discours/Footer'
import { Header } from '../HeaderNav'
import styles from './PageLayout.module.scss'

type PageLayoutProps = {
  title: string
  desc?: string
  keywords?: string
  headerTitle?: string
  slug?: string
  article?: Shout
  author?: Author // Add author prop for author pages
  topic?: Topic // Add topic prop for topic pages
  cover?: string
  children: JSX.Element
  isHeaderFixed?: boolean
  hideFooter?: boolean
  class?: string
  withPadding?: boolean
  zeroBottomPadding?: boolean
  key?: string
}

export const PageLayout = (props: PageLayoutProps) => {
  const [isInitialLoad, setIsInitialLoad] = createSignal(true)
  const isHeaderFixed = props.isHeaderFixed === undefined ? true : props.isHeaderFixed // FIXME: выглядит как костылек
  const loc = useLocation()
  const { t, lang } = useLocalize()
  const imageUrl = getFileUrl(props.cover ? props.cover : `${cdnUrl}/production/image/logo_image.png`)

  // OG image generation
  const ogImage = createMemo(() => {
    if (props.article) return getArticleOGImage(props.article)

    if (props.author) {
      return getAuthorOGImage(props.author)
    }

    // For topic pages, use topic-specific OG image
    if (props.topic) {
      const ogUrl = getTopicOGImage(props.topic)
      return ogUrl
    }
    return OG_BASIC_URL
  })

  const description = createMemo(() => props.desc || (props.article && descFromBody(props.article.body)))
  const keywords = createMemo(() => {
    const keypath = (props.key || loc?.pathname.split('/')[0]) as keyof typeof ruKeywords
    return props.keywords || lang() === 'ru' ? ruKeywords[keypath] : enKeywords[keypath]
  })

  // Формируем полный URL текущей страницы для og:url
  const pageUrl = createMemo(() => {
    const baseUrl = 'https://testing3.discours.io'
    const path = loc.pathname || '/'
    return `${baseUrl}${path}`
  })

  onMount(() => {
    // Установить флаг после начального рендеринга
    setIsInitialLoad(false)
  })

  createEffect(() => {
    if (!(isInitialLoad() || props.article) && props.slug) {
      // Повторная попытка загрузки данных при неудаче
      const retryLoad = async () => {
        try {
          // Здесь логика повторной загрузки
          console.log('Retrying to load article', props.slug)
          const _res = await getShout({ slug: props.slug })
          // console.log('res', res)
        } catch (error) {
          console.error('Failed to load article:', error)
        }
      }
      retryLoad()
    }
  })

  return (
    <>
      <Title>{props.article?.title || t(props.title)}</Title>
      <Header
        slug={props.slug}
        title={props.headerTitle}
        desc={props.desc}
        cover={imageUrl}
        isHeaderFixed={isHeaderFixed}
      />
      <Meta name="description" content={description() || ''} />
      <Meta name="keywords" content={keywords()} />
      <Meta property="og:type" content="article" />
      <Meta property="og:title" content={props.article?.title || t(props.title) || ''} />
      <Meta property="og:image" content={ogImage() || ''} />
      <Meta property="og:url" content={pageUrl()} />
      <Meta property="og:description" content={description() || ''} />
      <Meta property="og:logo" content={'/logo.png'} />
      <Meta property="og:locale" content={lang()} />
      <Meta name="twitter:card" content="summary_large_image" />
      <Meta name="twitter:image" content={ogImage() || ''} />
      <Meta name="twitter:title" content={props.article?.title || t(props.title) || ''} />
      <Meta name="twitter:description" content={description() || ''} />
      <main
        class={clsx('main-content', {
          [styles.zeroBottomPadding]: props.zeroBottomPadding
        })}
        classList={{ 'main-content--no-padding': !isHeaderFixed }}
      >
        {props.children}
      </main>
      <Show when={props.hideFooter !== true}>
        <FooterView />
      </Show>
    </>
  )
}
