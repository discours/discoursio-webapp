import { Link } from '@solidjs/meta'
import { A, useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, Suspense } from 'solid-js'
import { isServer } from 'solid-js/web'
import usePopper from 'solid-popper'
import { RatingControl } from '~/components/RatingControl/RatingControl'
import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { DEFAULT_HEADER_OFFSET, useUI } from '~/context/ui'
import type { Author, Maybe, Shout, Topic } from '~/graphql/generated/graphql'
import { MediaItem, ReactionKind } from '~/graphql/generated/graphql'
import { processPrepositions } from '~/intl/prepositions'
import { isCyrillic } from '~/intl/translate'
import { getCdnUrl } from '~/lib/imageCache'
// ✅ patchBodyUrls удален - больше не нужен
import { capitalize } from '~/utils/capitalize'
import { Icon } from '../_shared/Icon'
import { Image } from '../_shared/Image'
import { InviteMembers } from '../_shared/InviteMembers'
import { Lightbox } from '../_shared/Lightbox'
import { Loading } from '../_shared/Loading'
import { Modal } from '../_shared/Modal'
import { Popover } from '../_shared/Popover'
import { ShareModal } from '../_shared/ShareModal'
import { ImageSwiper } from '../_shared/SolidSwiper'
import { TableOfContents } from '../_shared/TableOfContents'
import { VideoPlayer } from '../_shared/VideoPlayer'
import { AuthorBadge } from '../Author/AuthorBadge'
import { CommentsTree } from '../Comments/CommentsTree'
import { CardTopic } from '../Feed/CardTopic'
import { FeedArticlePopup } from '../Feed/FeedArticlePopup'
import stylesHeader from '../HeaderNav/Header.module.scss'
import styles from './Article.module.scss'
import { AudioHeader } from './AudioHeader'
import { AudioPlayer } from './AudioPlayer/AudioPlayer'
import { getShareUrl, SharePopup } from './SharePopup'

type Props = {
  article: Shout
}

type IframeSize = {
  width: number
  height: number
}

export type ArticlePageSearchParams = {
  commentId?: string
  slide?: string
}

const COMMENTS_SCROLL_OFFSET = 20 // Дополнительный отступ для комментариев

const scrollTo = (el?: HTMLElement, isComments?: boolean) => {
  if (!(el && window)) return

  const { top } = el.getBoundingClientRect()
  const offset = DEFAULT_HEADER_OFFSET + (isComments ? COMMENTS_SCROLL_OFFSET : 0)
  console.debug('[FullArticle] scroll to', el, top, offset)
  window.scrollTo({
    top: top + window.scrollY - offset,
    left: 0,
    behavior: 'smooth'
  })
}

const imgSrcRegExp = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi

import { COMMENTS_PER_PAGE } from '~/constants/pagination'

const VOTES_PER_PAGE = 50

export const FullArticle = (props: Props) => {
  const [searchParams] = useSearchParams<ArticlePageSearchParams>()
  const { showModal } = useUI()
  const { loadReactionsBy, reactionsByShout } = useReactions()
  const [selectedImage, setSelectedImage] = createSignal('')
  const [isReactionsLoaded, setIsReactionsLoaded] = createSignal(false)
  const [isActionPopupActive, setIsActionPopupActive] = createSignal(false)
  const { t, formatDate, lang } = useLocalize()
  const { session, requireAuthentication } = useSession()
  const { addSeen } = useFeed()
  const [pages, setPages] = createSignal<Record<string, number>>({})
  const [commentsWrapper, setCommentsWrapper] = createSignal<HTMLElement | undefined>()
  const [canEdit, setCanEdit] = createSignal<boolean>(false)

  const body = createMemo(() => {
    let body = props.article.body || ''
    if (canEdit()) body = processPrepositions(body)
    // ✅ patchBodyUrls удален - больше не нужен
    return body
  })

  const imageUrls = createMemo(() => {
    if (!body()) {
      return []
    }

    if (isServer) {
      const result: string[] = []
      let match: RegExpMatchArray | null

      while ((match = imgSrcRegExp.exec(body())) !== null) {
        if (match) result.push(match[1])
        else break
      }
      return result
    }

    const imageElements = document.querySelectorAll<HTMLImageElement>('#shoutBody img')
    // eslint-disable-next-line unicorn/prefer-spread
    return Array.from(imageElements).map((img) => img.src)
  })

  const media = createMemo<MediaItem[]>(() => (props.article.media || []) as MediaItem[])

  const handleBookmarkButtonClick = (ev: MouseEvent | undefined) => {
    requireAuthentication(() => {
      // TODO: implement bookmark clicked
      ev?.preventDefault()
    }, 'bookmark')
  }

  const clickHandlers: { element: HTMLElement; handler: () => void }[] = []
  const documentClickHandlers: ((e: MouseEvent) => void)[] = []

  createEffect(
    on([() => searchParams?.commentId, commentsWrapper, isReactionsLoaded], ([cid, wrapper, loaded]) => {
      if (!(cid && loaded && wrapper)) return

      // First scroll - immediately go to comments section
      scrollTo(wrapper, true)

      // Set up observer to watch for DOM changes
      const observer = new MutationObserver(() => {
        const commentEl = document.querySelector<HTMLElement>(`[id='comment_${cid}']`)
        if (commentEl) {
          // Second scroll - when specific comment appears
          scrollTo(commentEl, true)
          // Stop observing once we find the comment
          observer.disconnect()
        }
      })

      // Start observing the comments wrapper for any changes to its children
      observer.observe(wrapper, {
        childList: true, // watch for changes to immediate children
        subtree: true // watch for changes to descendants
      })

      // Clean up observer when effect re-runs or unmounts
      onCleanup(() => observer.disconnect())
    })
  )

  createEffect(
    on(
      pages,
      (p: Record<string, number>) => {
        // console.debug('content paginated')
        loadReactionsBy({
          by: { shout: props.article.slug, kinds: [ReactionKind.Comment] },
          limit: COMMENTS_PER_PAGE,
          offset: COMMENTS_PER_PAGE * p.comments || 0
        })
        loadReactionsBy({
          by: { shout: props.article.slug, kinds: [ReactionKind.Like, ReactionKind.Dislike] },
          limit: VOTES_PER_PAGE,
          offset: VOTES_PER_PAGE * p.rating || 0
        })
        setIsReactionsLoaded(true)
        // console.debug('reactions paginated')
      },
      { defer: true }
    )
  )

  createEffect(
    on(
      () => session()?.author,
      (author?: Author) => {
        const isEditor = author?.roles?.includes('editor')
        const isCreator = props.article.created_by?.id === author?.id
        const fit = (a: Maybe<Author>) => a?.id === author?.id || isCreator || isEditor
        setCanEdit((_: boolean) => Boolean(props.article.authors?.some(fit)))
      }
    )
  )

  createEffect(() => {
    if (!body()) {
      return
    }

    const tooltipElements: NodeListOf<HTMLElement> = document.querySelectorAll('tooltip')
    if (!tooltipElements) {
      return
    }
    tooltipElements.forEach((element) => {
      const tooltip = document.createElement('div')
      tooltip.classList.add(styles.tooltip)
      const tooltipContent = document.createElement('div')
      tooltipContent.classList.add(styles.tooltipContent)
      tooltipContent.innerHTML = element.innerHTML

      tooltip.append(tooltipContent)

      document.body.append(tooltip)

      if (element.hasAttribute('href')) {
        element.setAttribute('href', 'javascript: void(0)')
      }

      const popperInstance = usePopper(
        () => element,
        () => tooltip,
        {
          placement: 'top',
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 8]
              }
            },
            {
              name: 'flip',
              options: { fallbackPlacements: ['top'] }
            }
          ]
        }
      )

      tooltip.style.visibility = 'hidden'
      let isTooltipVisible = false
      const handleClick = () => {
        if (isTooltipVisible) {
          tooltip.style.visibility = 'hidden'
          isTooltipVisible = false
        } else {
          tooltip.style.visibility = 'visible'
          isTooltipVisible = true
        }

        popperInstance()?.update()
      }

      const handleDocumentClick = (e: MouseEvent) => {
        const startTime = performance.now()
        const target = e.target as HTMLElement

        // ✅ Быстрый выход для навигационных элементов
        if (target.closest('a[href^="/@"]') || target.closest('a[rel="author"]')) {
          return
        }

        if (isTooltipVisible && e.target !== element && e.target !== tooltip) {
          tooltip.style.visibility = 'hidden'
          isTooltipVisible = false
          const endTime = performance.now()
          console.debug(`[FullArticle] Tooltip hidden: ${(endTime - startTime).toFixed(2)}ms`)
        }
      }

      element.addEventListener('click', handleClick)
      document.addEventListener('click', handleDocumentClick)

      clickHandlers.push({ element, handler: handleClick })
      documentClickHandlers.push(handleDocumentClick)
    })
  })

  onCleanup(() => {
    clickHandlers.forEach(({ element, handler }) => {
      element.removeEventListener('click', handler)
    })
    documentClickHandlers.forEach((handler) => {
      document.removeEventListener('click', handler)
    })
  })

  const handleArticleBodyClick = (event: MouseEvent) => {
    const startTime = performance.now()
    const target = event.target as HTMLElement

    // 🔍 Диагностика: логируем все клики для анализа
    console.debug('[FullArticle] Click detected:', {
      tagName: target.tagName,
      className: target.className,
      href: (target as HTMLAnchorElement).href,
      closest_author_link: target.closest('a[href^="/@"]'),
      closest_rel_author: target.closest('a[rel="author"]'),
      performance_start: startTime
    })

    // ✅ Быстрый выход для ссылок авторов и других навигационных элементов
    if (target.closest('a[href^="/@"]') || target.closest('a[rel="author"]')) {
      const endTime = performance.now()
      console.debug(`[FullArticle] Author link detected, early exit: ${(endTime - startTime).toFixed(2)}ms`)
      return
    }

    if (target.closest('.mediaItems')) {
      const endTime = performance.now()
      console.debug(`[FullArticle] Media item click, early exit: ${(endTime - startTime).toFixed(2)}ms`)
      return
    }

    // ✅ Только для изображений - останавливаем всплытие события
    if (target.tagName === 'IMG') {
      const endTime = performance.now()
      console.debug(`[FullArticle] Image click processed: ${(endTime - startTime).toFixed(2)}ms`)
      event.stopPropagation()
      setSelectedImage((target as HTMLImageElement).src)
    }

    const endTime = performance.now()
    console.debug(`[FullArticle] Total click handler time:${(endTime - startTime).toFixed(2)}ms`)
  }

  // Check iframes size
  const [articleContainer, setArticleContainer] = createSignal<HTMLElement | undefined>()
  const updateIframeSizes = () => {
    if (!window) return
    if (!(articleContainer() && props.article.body)) return
    const iframes = articleContainer()?.querySelectorAll('iframe')
    if (!iframes) return
    const containerWidth = articleContainer()?.offsetWidth || window.scrollX - 100 // NOTE: custom ifram padding
    iframes.forEach((iframe) => {
      const style = window.getComputedStyle(iframe)
      const originalWidth = iframe.getAttribute('width') || style.width.replace('px', '')
      const originalHeight = iframe.getAttribute('height') || style.height.replace('px', '')

      const width: IframeSize['width'] = Number(originalWidth)
      const height: IframeSize['height'] = Number(originalHeight)

      if (containerWidth < width) {
        const aspectRatio = width / height
        iframe.style.width = `${containerWidth}px`
        iframe.style.height = `${Math.round(containerWidth / aspectRatio) + 40}px`
      } else {
        iframe.style.height = `${containerWidth}px`
      }
    })
  }

  onMount(() => {
    // console.debug(props.article)
    setPages((_) => ({ comments: 0, rating: 0 }))
    addSeen(props.article.slug)
    document.title = props.article.title
    updateIframeSizes()
    window?.addEventListener('resize', updateIframeSizes)
    onCleanup(() => window.removeEventListener('resize', updateIframeSizes))
  })
  const shareUrl = createMemo(() => getShareUrl({ pathname: `/${props.article.slug || ''}` }))
  const getAuthorName = (a: Author) =>
    lang() === 'en' && isCyrillic(a.name || '') ? capitalize(a.slug.replace(/-/g, ' ')) : a.name

  const myRate = createMemo(
    () => reactionsByShout()[props.article.id || 0]?.find((r) => r.created_by.slug === session()?.author?.slug)?.kind
  )
  const ArticleActionsBar = () => (
    <div class={styles.shoutStats}>
      <div class={styles.shoutStatsItem}>
        <RatingControl shout={props.article} class={styles.ratingControl} myRate={myRate()} />
      </div>

      <Popover content={t('Comment')} disabled={isActionPopupActive()}>
        {(triggerRef: (el: HTMLElement) => void) => (
          <div class={clsx(styles.shoutStatsItem)} ref={triggerRef} onClick={() => scrollTo(commentsWrapper(), true)}>
            <Icon name="comment" class={styles.icon} />
            <Icon name="comment-hover" class={clsx(styles.icon, styles.iconHover)} />
            <Show
              when={props.article.stat?.comments_count}
              fallback={<span class={styles.commentsTextLabel}>{t('Add comment')}</span>}
            >
              {props.article.stat?.comments_count}
            </Show>
          </div>
        )}
      </Popover>

      <Show when={props.article.stat?.views_count}>
        <div class={clsx(styles.shoutStatsItem, styles.shoutStatsItemViews)}>
          {t('some views', { count: props.article.stat?.views_count || 0 })}
        </div>
      </Show>

      <div class={clsx(styles.shoutStatsItem, styles.shoutStatsItemAdditionalData)}>
        <div class={clsx(styles.shoutStatsItem, styles.shoutStatsItemAdditionalDataItem)}>
          {formatDate(props.article.published_at)}
        </div>
      </div>

      <Popover content={t('Add to bookmarks')} disabled={isActionPopupActive()}>
        {(triggerRef: (el: HTMLElement) => void) => (
          <div
            class={clsx(styles.shoutStatsItem, styles.shoutStatsItemBookmarks)}
            ref={triggerRef}
            onClick={handleBookmarkButtonClick}
          >
            <div class={styles.shoutStatsItemInner}>
              <Icon name="bookmark" class={styles.icon} />
              <Icon name="bookmark-hover" class={clsx(styles.icon, styles.iconHover)} />
            </div>
          </div>
        )}
      </Popover>

      <Popover content={t('Share')} disabled={isActionPopupActive()}>
        {(triggerRef: (el: HTMLElement) => void) => (
          <div class={styles.shoutStatsItem} ref={triggerRef}>
            <SharePopup
              title={props.article.title}
              description={props.article?.seo || ''}
              imageUrl={props.article.cover || ''}
              shareUrl={shareUrl()}
              containerCssClass={stylesHeader.control}
              onVisibilityChange={(isVisible) => setIsActionPopupActive(isVisible)}
              trigger={
                <div class={styles.shoutStatsItemInner}>
                  <Icon name="share-outline" class={styles.icon} />
                  <Icon name="share-outline-hover" class={clsx(styles.icon, styles.iconHover)} />
                </div>
              }
            />
          </div>
        )}
      </Popover>

      <Show when={canEdit()}>
        <Popover content={t('Edit')}>
          {(triggerRef: (el: HTMLElement) => void) => (
            <div class={styles.shoutStatsItem} ref={triggerRef}>
              <A href={`/edit/${props.article.id}`} class={styles.shoutStatsItemInner}>
                <Icon name="pencil-outline" class={styles.icon} />
                <Icon name="pencil-outline-hover" class={clsx(styles.icon, styles.iconHover)} />
              </A>
            </div>
          )}
        </Popover>
      </Show>

      <FeedArticlePopup
        canEdit={Boolean(canEdit())}
        containerCssClass={clsx(stylesHeader.control, styles.articlePopupOpener)}
        onShareClick={() => showModal('share')}
        onInviteClick={() => showModal('inviteMembers')}
        onVisibilityChange={(isVisible) => setIsActionPopupActive(isVisible)}
        trigger={
          <button>
            <Icon name="ellipsis" class={clsx(styles.icon)} />
            <Icon name="ellipsis" class={clsx(styles.icon, styles.iconHover)} />
          </button>
        }
      />
    </div>
  )

  const ArticleTopics = () => (
    <div class={styles.topicsList}>
      <For each={props.article.topics || []}>
        {(topic) => (
          <div class={styles.shoutTopic}>
            <A href={`/topic/${topic?.slug || ''}`}>
              {lang() === 'en' ? capitalize(topic?.slug || '') : topic?.title || ''}
            </A>
          </div>
        )}
      </For>
    </div>
  )

  const AuthorItem = (props: { author: Author }) => (
    <div class="col-xl-12">
      <AuthorBadge iconButtons={true} showMessageButton={false} author={props.author} />
    </div>
  )

  const ArticleAuthors = () => (
    <div>
      <Show
        when={(props.article.authors?.length || 0) > 1}
        fallback={
          <Show when={props.article.created_by}>
            <AuthorItem author={props.article.created_by as Author} />
          </Show>
        }
      >
        <h4>{t('Authors')}</h4>
      </Show>
      <div class={styles.shoutAuthorsList}>
        <For each={props.article.authors?.filter((a: Maybe<Author>) => a?.id)}>
          {(a: Maybe<Author>) => <AuthorItem author={a as Author} />}
        </For>
      </div>
    </div>
  )

  return (
    <>
      <For each={imageUrls()}>{(imageUrl) => <Link rel="preload" as="image" href={imageUrl} />}</For>

      <div class="wide-container">
        <div class="row position-relative">
          <article
            ref={setArticleContainer}
            class={clsx(
              'col-md-16 col-lg-14 col-xl-12 offset-md-5',
              styles[`${props.article.layout}Layout` as keyof typeof styles]
            )}
            aria-labelledby="article-title"
            aria-describedby="article-content"
          >
            {/*TODO: Check styles.shoutTopic*/}
            <Show when={props.article.layout !== 'audio'}>
              <header class={styles.shoutHeader}>
                <Show when={props.article.main_topic}>
                  <CardTopic
                    title={props.article.main_topic?.title || ''}
                    slug={props.article.main_topic?.slug || ''}
                  />
                </Show>

                <h1 id="article-title">{props.article.title || ''}</h1>
                <Show when={props.article.subtitle}>
                  <h2 class="article-subtitle">{processPrepositions(props.article.subtitle || '')}</h2>
                </Show>

                <div class={styles.shoutAuthor}>
                  <For each={props.article.authors}>
                    {(a: Maybe<Author>, index: () => number) => (
                      <>
                        <Show when={index() > 0}>, </Show>
                        <A href={`/@${a?.slug}`} rel="author">
                          {a && getAuthorName(a)}
                        </A>
                      </>
                    )}
                  </For>
                </div>
              </header>
            </Show>

            {/* 🔧  Оптимизированный обработчик кликов только для изображений */}
            <div onClick={handleArticleBodyClick}>
              <Show when={props.article?.cover && props.article.layout !== 'video' && props.article.layout !== 'image'}>
                <figure class={styles.figureAlignColumn}>
                  <Image
                    width={1200}
                    alt={props.article?.cover_caption || ''}
                    src={getCdnUrl(props.article?.cover || '')}
                  />
                  <figcaption innerHTML={props.article?.cover_caption || ''} />
                </figure>
              </Show>

              <Show when={props.article.lead}>
                <section class={styles.lead} innerHTML={processPrepositions(props.article.lead || '')} />
              </Show>

              <Show when={props.article.layout === 'audio'}>
                <AudioHeader
                  title={props.article.title || ''}
                  cover={props.article?.cover || ''}
                  artistData={media()?.[0]}
                  topic={props.article.main_topic as Topic}
                />
                <Show when={media().length > 0}>
                  <div class="mediaItems">
                    <AudioPlayer media={media()} articleSlug={props.article.slug || ''} body={body()} />
                  </div>
                </Show>
              </Show>

              <Show when={media() && props.article.layout === 'video'}>
                <div class="mediaItems">
                  <For each={media() || []}>
                    {(m: MediaItem) => (
                      <div class={styles.shoutMediaBody}>
                        <VideoPlayer
                          articleView={true}
                          videoUrl={m.url || ''}
                          title={m.title || ''}
                          description={m.body || ''}
                        />
                        <Show when={m?.body}>
                          <div innerHTML={m.body || ''} />
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={body() && props.article.layout !== 'audio' && props.article.layout !== 'video'}>
                <div id="shoutBody" class={styles.shoutBody} innerHTML={body()} />
              </Show>
            </div>
          </article>

          <Show when={body() && props.article.layout !== 'audio' && props.article.layout !== 'video'}>
            <div class="col-md-6 offset-md-1">
              <TableOfContents variant="article" parentSelector="#shoutBody" body={body()} />
            </div>
          </Show>
        </div>
      </div>

      <Show when={props.article.layout === 'image'}>
        <div class="floor floor--important">
          <div class="wide-container">
            <div class="row">
              <div class="col-md-20 offset-md-2">
                <ImageSwiper images={media()} />
              </div>
            </div>
          </div>
        </div>
      </Show>

      <Show when={selectedImage()}>
        <Lightbox image={selectedImage()} onClose={() => setSelectedImage('')} />
      </Show>

      <Modal variant="medium" name="inviteMembers">
        <InviteMembers variant={'coauthors'} title={t('Invite experts')} />
      </Modal>

      <ShareModal
        title={props.article.title}
        description={props.article?.seo || ''}
        imageUrl={props.article?.cover || ''}
        shareUrl={shareUrl()}
      />

      <div class="wide-container">
        <div class="row">
          <div class="col-md-16 offset-md-5">
            <ArticleActionsBar />

            <Show when={session()?.token && !canEdit() && !isServer}>
              <div class={styles.help}>
                <button class="button">{t('Cooperate')}</button>
              </div>
            </Show>

            <Show when={canEdit() && !isServer}>
              <div class={styles.help}>
                <button class="button button--light">{t('Invite to collab')}</button>
              </div>
            </Show>

            <ArticleTopics />

            <Suspense>
              <ArticleAuthors />
            </Suspense>

            <div id="comments" ref={setCommentsWrapper}>
              <Show when={isReactionsLoaded()} fallback={<Loading />}>
                <CommentsTree
                  shoutId={props.article.id}
                  shoutSlug={props.article.slug}
                  articleAuthors={props.article.authors as Author[]}
                  totalComments={props.article.stat?.comments_count || 0}
                />
              </Show>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
