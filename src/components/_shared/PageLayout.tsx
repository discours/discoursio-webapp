import { Meta, Title } from '@solidjs/meta'
import { useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import type { JSX } from 'solid-js'
import { Show, createMemo, createSignal, onMount } from 'solid-js'
import { cdnUrl } from '~/config'
import { useLocalize } from '~/context/localize'
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
  const isHeaderFixed = props.isHeaderFixed === undefined ? true : props.isHeaderFixed // FIXME: выглядит как костылек
  const loc = useLocation()
  const { t, lang } = useLocalize()
  const imageUrl = getFileUrl(props.cover ? props.cover : `${cdnUrl}/production/image/logo_image.png`)

  // Определяем тип контента для OG
  const contentType = createMemo(() => {
    if (props.article) return 'article'
    if (props.author) return 'profile'
    if (props.topic) return 'topic'
    return 'website'
  })

  const description = createMemo(() => {
    if (props.desc) return props.desc
    if (props.article?.body) return descFromBody(props.article.body)
    if (props.author?.bio) return props.author.bio
    if (props.topic?.body) return descFromBody(props.topic.body)
    return t('Discours — open editorial community')
  })

  const keywords = createMemo(() => {
    const keypath = (props.key || loc?.pathname.split('/')[0]) as keyof typeof ruKeywords
    return props.keywords || lang() === 'ru' ? ruKeywords[keypath] : enKeywords[keypath]
  })

  // Формируем полный URL текущей страницы для og:url
  const [baseUrl, setBaseUrl] = createSignal('')
  const [pageUrl, setPageUrl] = createSignal('')
  onMount(() => {
    setBaseUrl(window?.location.origin || 'https://testing3.discours.io')
    setPageUrl(`${baseUrl()}${loc.pathname}`)
  })

  // OG image generation с абсолютными URL
  const ogImage = createMemo(() => {
    let relativePath = ''

    if (props.article) {
      relativePath = getArticleOGImage(props.article)
    } else if (props.author) {
      relativePath = getAuthorOGImage(props.author)
    } else if (props.topic) {
      relativePath = getTopicOGImage(props.topic)
    } else {
      relativePath = OG_BASIC_URL
    }
    // Убедимся, что URL абсолютный для Open Graph
    return relativePath.startsWith('http') ? relativePath : `${baseUrl()}${relativePath}`
  })

  // Название для og:title
  const ogTitle = createMemo(() => {
    if (props.article) return props.article.title
    if (props.author) return props.author.name
    if (props.topic) return props.topic.title
    return t(props.title)
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
      {/* Основные мета-теги */}
      <Meta name="description" content={description() || ''} />
      <Meta name="keywords" content={keywords()} />

      {/* Open Graph теги */}
      <Meta property="og:type" content={contentType()} />
      <Meta property="og:title" content={ogTitle() || ''} />
      <Meta property="og:site_name" content={t('Discours')} />
      <Meta property="og:description" content={description() || ''} />
      <Meta property="og:url" content={pageUrl()} />
      <Meta property="og:image" content={ogImage() || ''} />
      <Meta property="og:image:width" content="1200" />
      <Meta property="og:image:height" content="630" />
      <Meta property="og:locale" content={lang()} />

      {/* Twitter Card теги */}
      <Meta name="twitter:card" content="summary_large_image" />
      <Meta name="twitter:site" content="@discoursio" />
      <Meta name="twitter:title" content={ogTitle() || ''} />
      <Meta name="twitter:description" content={description() || ''} />
      <Meta name="twitter:image" content={ogImage() || ''} />

      <main
        class={clsx('main-content', {
          [styles.zeroBottomPadding]: props.zeroBottomPadding
        })}
        classList={{ 'main-content--no-padding': !isHeaderFixed }}
      >
        {props.children}
      </main>
      <Show when={!props.hideFooter}>
        <FooterView />
      </Show>
    </>
  )
}
