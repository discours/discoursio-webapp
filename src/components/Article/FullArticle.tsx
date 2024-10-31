import { AuthToken } from '@authorizerdev/authorizer-js'
import { Link } from '@solidjs/meta'
import { A, useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from 'solid-js'
import { isServer } from 'solid-js/web'
import usePopper from 'solid-popper'
import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { DEFAULT_HEADER_OFFSET, useUI } from '~/context/ui'
import { ReactionKind } from '~/graphql/schema/core.gen'
import type { Author, Maybe, Shout, Topic } from '~/graphql/schema/core.gen'
import { processPrepositions } from '~/intl/prepositions'
import { isCyrillic } from '~/intl/translate'
import { getFileUrl } from '~/lib/getThumbUrl'
import { MediaItem } from '~/types/mediaitem'
import { capitalize } from '~/utils/capitalize'
import { AuthorBadge } from '../Author/AuthorBadge'
import { CardTopic } from '../Feed/CardTopic'
import { FeedArticlePopup } from '../Feed/FeedArticlePopup'
import { Icon } from '../_shared/Icon'
import { Image } from '../_shared/Image'
import { InviteMembers } from '../_shared/InviteMembers'
import { Lightbox } from '../_shared/Lightbox'
import { Modal } from '../_shared/Modal'
import { Popover } from '../_shared/Popover'
import { ShareModal } from '../_shared/ShareModal'
import { ImageSwiper } from '../_shared/SolidSwiper'
import { TableOfContents } from '../_shared/TableOfContents'
import { VideoPlayer } from '../_shared/VideoPlayer'
import { AudioHeader } from './AudioHeader'
import { AudioPlayer } from './AudioPlayer'
import { CommentsTree } from './CommentsTree'
import { RatingControl } from './RatingControl'
import { SharePopup, getShareUrl } from './SharePopup'

import stylesHeader from '../HeaderNav/Header.module.scss'
import styles from './Article.module.scss'

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

const scrollTo = (el: HTMLElement) => {
  const { top } = el.getBoundingClientRect()

  window?.scrollTo({
    top: top + window.scrollY - DEFAULT_HEADER_OFFSET,
    left: 0,
    behavior: 'smooth'
  })
}

const imgSrcRegExp = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi
export const COMMENTS_PER_PAGE = 30
const VOTES_PER_PAGE = 50

export const FullArticle = (props: Props) => {
  const [searchParams] = useSearchParams<ArticlePageSearchParams>()
  const { showModal } = useUI()
  const { loadReactionsBy } = useReactions()
  const [selectedImage, setSelectedImage] = createSignal('')
  const [isReactionsLoaded, setIsReactionsLoaded] = createSignal(false)
  const [isActionPopupActive, setIsActionPopupActive] = createSignal(false)
  const { t, formatDate, lang } = useLocalize()
  const { session, requireAuthentication } = useSession()
  const { addSeen } = useFeed()
  const [pages, setPages] = createSignal<Record<string, number>>({})
  const [commentsWrapper, setCommentsWrapper] = createSignal<HTMLElement | undefined>()
  const [canEdit, setCanEdit] = createSignal<boolean>(false)

  const formattedDate = createMemo(() => formatDate(new Date((props.article.published_at || 0) * 1000)))

  const body = createMemo(() => {
    if (props.article.layout === 'literature') {
      try {
        if (props.article.media) {
          const media = JSON.parse(props.article.media)
          if (media.length > 0) {
            return processPrepositions(media[0].body)
          }
        }
      } catch (error) {
        console.error(error)
      }
    }
    return processPrepositions(props.article.body) || ''
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

  const media = createMemo<MediaItem[]>(() => JSON.parse(props.article.media || '[]'))

  const mainTopic = createMemo(() => {
    const mainTopicSlug = (props.article.topics?.length || 0) > 0 ? props.article.main_topic?.slug : null
    const mt = props.article.topics?.find((tpc: Maybe<Topic>) => tpc?.slug === mainTopicSlug)
    if (mt) {
      mt.title = lang() === 'en' ? capitalize(mt.slug.replaceAll('-', ' ')) : mt.title
      return mt
    }
    return props.article.topics?.[0]
  })

  const handleBookmarkButtonClick = (ev: MouseEvent | undefined) => {
    requireAuthentication(() => {
      // TODO: implement bookmark clicked
      ev?.preventDefault()
    }, 'bookmark')
  }

  const clickHandlers: { element: HTMLElement; handler: () => void }[] = []
  const documentClickHandlers: ((e: MouseEvent) => void)[] = []

  createEffect(() => {
    if (searchParams?.commentId && isReactionsLoaded()) {
      console.debug('comment id is in link, scroll to')
      const scrollToElement =
        document.querySelector<HTMLElement>(`[id='comment_${searchParams?.commentId}']`) ||
        commentsWrapper() ||
        document.body

      if (scrollToElement) {
        requestAnimationFrame(() => scrollTo(scrollToElement))
      }
    }
  })

  createEffect(
    on(
      pages,
      (p: Record<string, number>) => {
        console.debug('content paginated')
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
        console.debug('reactions paginated')
      },
      { defer: true }
    )
  )

  createEffect(
    on(
      () => session(),
      (s?: AuthToken) => {
        const profile = s?.user?.app_data?.profile
        if (!profile) return
        const isEditor = s?.user?.roles?.includes('editor')
        const isCreator = props.article.created_by?.id === profile.id
        const fit = (a: Maybe<Author>) => a?.id === profile.id || isCreator || isEditor
        setCanEdit((_: boolean) => Boolean(props.article.authors?.some(fit)))
      }
    )
  )

  createEffect(() => {
    if (!body()) {
      return
    }

    const tooltipElements: NodeListOf<HTMLElement> = document.querySelectorAll(
      '[data-toggle="tooltip"], footnote'
    )
    if (!tooltipElements) {
      return
    }
    tooltipElements.forEach((element) => {
      const tooltip = document.createElement('div')
      tooltip.classList.add(styles.tooltip)
      const tooltipContent = document.createElement('div')
      tooltipContent.classList.add(styles.tooltipContent)
      tooltipContent.innerHTML = element.dataset.originalTitle || element.dataset.value || ''

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
        if (isTooltipVisible && e.target !== element && e.target !== tooltip) {
          tooltip.style.visibility = 'hidden'
          isTooltipVisible = false
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

  // biome-ignore lint/suspicious/noExplicitAny: FIXME: typing
  const handleArticleBodyClick = (event: any) => {
    if (event.target.tagName === 'IMG' && !event.target.dataset.disableLightbox) {
      const src = event.target.src
      setSelectedImage(getFileUrl(src))
    }
  }

  // Check iframes size
  let articleContainer: HTMLElement | undefined
  const updateIframeSizes = () => {
    if (!window) return
    if (!(articleContainer && props.article.body)) return
    const iframes = articleContainer?.querySelectorAll('iframe')
    if (!iframes) return
    const containerWidth = articleContainer?.offsetWidth
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
    console.debug(props.article)
    setPages((_) => ({ comments: 0, rating: 0 }))
    addSeen(props.article.slug)
    document.title = props.article.title
    updateIframeSizes()
    window?.addEventListener('resize', updateIframeSizes)
    onCleanup(() => window.removeEventListener('resize', updateIframeSizes))
  })

  const shareUrl = createMemo(() => getShareUrl({ pathname: `/${props.article.slug || ''}` }))
  const getAuthorName = (a: Author) =>
    lang() === 'en' && isCyrillic(a.name || '') ? capitalize(a.slug.replaceAll('-', ' ')) : a.name

  const ArticleActionsBar = () => (
    <div class={styles.shoutStats}>
      <div class={styles.shoutStatsItem}>
        <RatingControl shout={props.article} class={styles.ratingControl} />
      </div>

      <Popover content={t('Comment')} disabled={isActionPopupActive()}>
        {(triggerRef: (el: HTMLElement) => void) => (
          <div
            class={clsx(styles.shoutStatsItem)}
            ref={triggerRef}
            onClick={() => commentsWrapper() && scrollTo(commentsWrapper() as HTMLElement)}
          >
            <Icon name="comment" class={styles.icon} />
            <Icon name="comment-hover" class={clsx(styles.icon, styles.iconHover)} />
            <Show
              when={props.article.stat?.commented}
              fallback={<span class={styles.commentsTextLabel}>{t('Add comment')}</span>}
            >
              {props.article.stat?.commented}
            </Show>
          </div>
        )}
      </Popover>

      <Show when={props.article.stat?.viewed}>
        <div class={clsx(styles.shoutStatsItem, styles.shoutStatsItemViews)}>
          {t('some views', { count: props.article.stat?.viewed || 0 })}
        </div>
      </Show>

      <div class={clsx(styles.shoutStatsItem, styles.shoutStatsItemAdditionalData)}>
        <div class={clsx(styles.shoutStatsItem, styles.shoutStatsItemAdditionalDataItem)}>
          {formattedDate()}
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
              description={props.article.description || body() || media()[0]?.body}
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
      <AuthorBadge iconButtons={true} showMessageButton={true} author={props.author} />
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
            ref={(el) => (articleContainer = el)}
            class={clsx('col-md-16 col-lg-14 col-xl-12 offset-md-5', styles.articleContent)}
            onClick={handleArticleBodyClick}
          >
            {/*TODO: Check styles.shoutTopic*/}
            <Show when={props.article.layout !== 'audio'}>
              <div class={styles.shoutHeader}>
                <Show when={mainTopic()}>
                  <CardTopic title={mainTopic()?.title || ''} slug={mainTopic()?.slug || ''} />
                </Show>

                <h1>{props.article.title || ''}</h1>
                <Show when={props.article.subtitle}>
                  <h4>{processPrepositions(props.article.subtitle || '')}</h4>
                </Show>

                <div class={styles.shoutAuthor}>
                  <For each={props.article.authors}>
                    {(a: Maybe<Author>, index: () => number) => (
                      <>
                        <Show when={index() > 0}>, </Show>
                        <A href={`/@${a?.slug}`}>{a && getAuthorName(a)}</A>
                      </>
                    )}
                  </For>
                </div>
                <Show
                  when={
                    props.article.cover &&
                    props.article.layout !== 'video' &&
                    props.article.layout !== 'image'
                  }
                >
                  <figure class={styles.figureAlignColumn}>
                    <Image
                      width={800}
                      alt={props.article.cover_caption || ''}
                      src={props.article.cover || ''}
                    />
                    <figcaption innerHTML={props.article.cover_caption || ''} />
                  </figure>
                </Show>
              </div>
            </Show>

            <Show when={props.article.lead}>
              <section class={styles.lead} innerHTML={processPrepositions(props.article.lead || '')} />
            </Show>

            <Show when={props.article.layout === 'audio'}>
              <AudioHeader
                title={props.article.title || ''}
                cover={props.article.cover || ''}
                artistData={media()?.[0]}
                topic={mainTopic() as Topic}
              />
              <Show when={media().length > 0}>
                <div class="media-items">
                  <AudioPlayer media={media()} articleSlug={props.article.slug || ''} body={body()} />
                </div>
              </Show>
            </Show>

            <Show when={media() && props.article.layout === 'video'}>
              <div class="media-items">
                <For each={media() || []}>
                  {(m: MediaItem) => (
                    <div class={styles.shoutMediaBody}>
                      <VideoPlayer
                        articleView={true}
                        videoUrl={m.url}
                        title={m.title}
                        description={m.body}
                      />
                      <Show when={m?.body}>
                        <div innerHTML={m.body} />
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={body()}>
              <div id="shoutBody" class={styles.shoutBody} innerHTML={body()} />
            </Show>
          </article>

          <Show when={body()}>
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
        description={props.article.description || body() || media()[0]?.body}
        imageUrl={props.article.cover || ''}
        shareUrl={shareUrl()}
      />

      <div class="wide-container">
        <div class="row">
          <div class="col-md-16 offset-md-5">
            <ArticleActionsBar />

            <Show when={session()?.access_token && !canEdit() && !isServer}>
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

            <ArticleAuthors />

            <div id="comments" ref={setCommentsWrapper}>
              <Show when={isReactionsLoaded()}>
                <CommentsTree
                  shoutId={props.article.id}
                  shoutSlug={props.article.slug}
                  articleAuthors={props.article.authors as Author[]}
                />
              </Show>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
