import { Meta, Title } from '@solidjs/meta'
import { useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import type { JSX } from 'solid-js'
import { Show, createMemo } from 'solid-js'
import { cdnUrl } from '~/config'
import { useLocalize } from '~/context/localize'
import { Author, Shout, Topic } from '~/graphql/schema/core.gen'
import enKeywords from '~/intl/locales/en/keywords.json'
import ruKeywords from '~/intl/locales/ru/keywords.json'
import { getFileUrl } from '~/lib/getThumbUrl'
import { generateOGMetadata } from '~/lib/openGraph'
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

  const keywords = createMemo(() => {
    const keypath = (props.key || loc?.pathname.split('/')[0]) as keyof typeof ruKeywords
    return props.keywords || lang() === 'ru' ? ruKeywords[keypath] : enKeywords[keypath]
  })

  // Определяем контент для OG-тегов
  const content = createMemo(() => {
    if (props.article) return props.article
    if (props.author) return props.author
    if (props.topic) return props.topic
    return undefined
  })

  // Генерируем все метаданные для OG в одном вызове
  const ogMetadata = createMemo(() => {
    return generateOGMetadata(content(), {
      pathname: loc.pathname,
      defaultTitle: t(props.title),
      defaultDescription: props.desc,
      locale: lang()
    })
  })

  // Получаем описание напрямую через дедупликацию логики
  const description = createMemo(() => ogMetadata().description)

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
      <Meta name="description" content={description()} />
      <Meta name="keywords" content={keywords()} />

      {/* Open Graph теги - все обязательные и дополнительные теги */}
      <Meta property="og:type" content={ogMetadata().type} />
      <Meta property="og:title" content={ogMetadata().title} />
      <Meta property="og:site_name" content={ogMetadata().siteName} />
      <Meta property="og:description" content={ogMetadata().description} />
      <Meta property="og:url" content={ogMetadata().url} />
      <Meta property="og:image" content={ogMetadata().image} />
      <Meta property="og:image:width" content={ogMetadata().imageWidth?.toString()} />
      <Meta property="og:image:height" content={ogMetadata().imageHeight?.toString()} />
      <Meta property="og:locale" content={ogMetadata().locale} />
      <Meta property="og:logo" content={ogMetadata().logo} />

      {/* Twitter Card теги */}
      <Meta name="twitter:card" content={ogMetadata().twitterCard} />
      <Meta name="twitter:site" content="@discoursio" />
      <Meta name="twitter:title" content={ogMetadata().title} />
      <Meta name="twitter:description" content={ogMetadata().description} />
      <Meta name="twitter:image" content={ogMetadata().image} />

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
