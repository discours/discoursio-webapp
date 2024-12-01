import { A, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { Accessor, For, Show, createMemo, createSignal } from 'solid-js'
import { RatingControl } from '~/components/RatingControl/RatingControl'
import { Icon } from '~/components/_shared/Icon'
import { Image } from '~/components/_shared/Image'
import { Popover } from '~/components/_shared/Popover'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import type { Author, Maybe, ReactionKind, Shout } from '~/graphql/schema/core.gen'
import { capitalize } from '~/utils/capitalize'
import { descFromBody } from '~/utils/meta'
import { CoverImage } from '../../Article/CoverImage'
import { SharePopup, getShareUrl } from '../../Article/SharePopup'
import { AuthorLink } from '../../Author/AuthorLink'
import { CardTopic } from '../CardTopic'
import { FeedArticlePopup } from '../FeedArticlePopup'

import stylesHeader from '../../HeaderNav/Header.module.scss'
import styles from './ArticleCard.module.scss'

export type ArticleCardProps = {
  // TODO: refactor this, please
  settings?: {
    noicon?: boolean
    noimage?: boolean
    nosubtitle?: boolean
    noauthor?: boolean
    nodate?: boolean
    isGroup?: boolean
    photoBottom?: boolean
    additionalClass?: string
    isFeedMode?: boolean
    isFloorImportant?: boolean
    isWithCover?: boolean
    isBigTitle?: boolean
    isVertical?: boolean
    isShort?: boolean
    withBorder?: boolean
    isCompact?: boolean
    isSingle?: boolean
    isBeside?: boolean
    withViewed?: boolean
    noAuthorLink?: boolean
  }
  withAspectRatio?: boolean
  desktopCoverSize?: string // 'XS' | 'S' | 'M' | 'L'
  article: Shout
  onShare?: (article: Shout) => void
  onInvite?: () => void
  myRate?: ReactionKind | undefined
  isBookmarked?: boolean
}

const desktopCoverImageWidths: Record<string, number> = {
  XS: 300,
  S: 400,
  M: 600,
  L: 800
}
const titleSeparator = /{!|\?|:|;}\s/
const getTitleAndSubtitle = (
  article: Shout
): {
  title: string
  subtitle: string
} => {
  let title = article.title || ''
  let subtitle: string = article.subtitle || ''

  if (!subtitle) {
    let titleParts = article.title?.split('. ') || []

    if (titleParts?.length === 1) {
      titleParts = article.title?.split(titleSeparator) || []
    }

    if (titleParts && titleParts.length > 1) {
      const sep = article.title?.replace(titleParts[0], '').split(' ', 1)[0]
      title = titleParts[0] + (sep === '.' || sep === ':' ? '' : sep)
      subtitle = capitalize(article.title?.replace(titleParts[0] + sep, ''), true) || ''
    }
  }

  // TODO: simple fast auto translated title/substitle

  return { title, subtitle }
}

const LAYOUT_ASPECT: { [key: string]: string } = {
  music: styles.aspectRatio1x1,
  audio: styles.aspectRatio1x1,
  literature: styles.aspectRatio16x9,
  video: styles.aspectRatio16x9,
  image: styles.aspectRatio4x3
}

export const ArticleCard = (props: ArticleCardProps) => {
  const { t, formatDate } = useLocalize()
  const { session } = useSession()
  const author = createMemo<Author>(() => session()?.user?.app_data?.profile as Author)
  const [isActionPopupActive, setIsActionPopupActive] = createSignal(false)
  const [isCoverImageLoadError, setIsCoverImageLoadError] = createSignal(false)
  const [isCoverImageLoading, setIsCoverImageLoading] = createSignal(true)
  const description = descFromBody(props.article.body)
  const aspectRatio: Accessor<string> = () => LAYOUT_ASPECT[props.article.layout as string]
  const { title, subtitle } = getTitleAndSubtitle(props.article)

  const formattedDate = createMemo<string>(() =>
    props.article.published_at ? formatDate(new Date(props.article.published_at * 1000)) : ''
  )

  const canEdit = createMemo(
    () =>
      Boolean(author()?.id) &&
      (props.article.authors?.some((a) => Boolean(a) && a?.id === author().id) ||
        props.article.created_by?.id === author().id ||
        session()?.user?.roles?.includes('editor'))
  )
  const navigate = useNavigate()

  const scrollToComments = (event: MouseEvent & { currentTarget: HTMLAnchorElement; target: Element }) => {
    event.preventDefault()
    navigate(`/${props.article.slug}?commentId=0`)
  }

  const onInvite = () => {
    if (props.onInvite) props.onInvite()
  }

  const mainTopic = createMemo(() => props.article.main_topic || props.article.topics?.[0])
  return (
    <section
      class={clsx(styles.shoutCard, props.settings?.additionalClass, {
        [styles.shoutCardShort]: props.settings?.isShort,
        [styles.shoutCardPhotoBottom]: props.settings?.noimage && props.settings?.photoBottom,
        [styles.shoutCardFeed]: props.settings?.isFeedMode,
        [styles.shoutCardFloorImportant]: props.settings?.isFloorImportant,
        [styles.shoutCardWithCover]: props.settings?.isWithCover,
        [styles.shoutCardBigTitle]: props.settings?.isBigTitle,
        [styles.shoutCardVertical]: props.settings?.isVertical,
        [styles.shoutCardWithBorder]: props.settings?.withBorder,
        [styles.shoutCardCompact]: props.settings?.isCompact,
        [styles.shoutCardSingle]: props.settings?.isSingle,
        [styles.shoutCardBeside]: props.settings?.isBeside,
        [styles.shoutCardNoImage]: !props.article.cover,
        [aspectRatio()]: props.withAspectRatio
      })}
    >
      {/* Cover Image */}
      <Show when={!(props.settings?.noimage || props.settings?.isFeedMode)}>
        {/* Cover Image Container */}
        <div class={styles.shoutCardCoverContainer}>
          <div
            class={clsx(styles.shoutCardCover, {
              [styles.loading]: props.article.cover && isCoverImageLoading()
            })}
          >
            <Show
              when={props.article.cover && !isCoverImageLoadError()}
              fallback={<CoverImage class={styles.placeholderCoverImage} />}
            >
              <Image
                src={props.article.cover || ''}
                alt={title}
                width={desktopCoverImageWidths[props.desktopCoverSize || 'M']}
                onError={() => {
                  setIsCoverImageLoadError(true)
                  setIsCoverImageLoading(false)
                }}
                onLoad={() => setIsCoverImageLoading(false)}
              />
            </Show>
          </div>
        </div>
      </Show>

      {/* Shout Card Content */}
      <div class={styles.shoutCardContent}>
        {/* Shout Card Icon */}
        <Show
          when={
            props.article.layout &&
            props.article.layout !== 'article' &&
            !(props.settings?.noicon || props.settings?.noimage) &&
            !props.settings?.isFeedMode
          }
        >
          <div class={styles.shoutCardType}>
            <A href={`/expo/${props.article.layout}`}>
              <Icon name={props.article.layout} class={styles.icon} />
            </A>
          </div>
        </Show>

        {/* Main Topic */}
        <Show when={!props.settings?.isGroup && mainTopic()}>
          <CardTopic
            title={mainTopic()?.title || ''}
            slug={mainTopic()?.slug || ''}
            isFloorImportant={props.settings?.isFloorImportant}
            isFeedMode={true}
            class={clsx(styles.shoutTopic, { [styles.shoutTopicTop]: props.settings?.isShort })}
          />
        </Show>

        {/* Title and Subtitle */}
        <div
          class={clsx(styles.shoutCardTitlesContainer, {
            [styles.shoutCardTitlesContainerFeedMode]: props.settings?.isFeedMode
          })}
        >
          <A href={`/${props.article.slug}`}>
            <div class={styles.shoutCardTitle}>
              <span class={styles.shoutCardLinkWrapper}>
                <span class={styles.shoutCardLinkContainer} innerHTML={title} />
              </span>
            </div>

            <Show when={!props.settings?.nosubtitle && subtitle}>
              <div class={styles.shoutCardSubtitle}>
                <span class={styles.shoutCardLinkContainer} innerHTML={subtitle || ''} />
              </div>
            </Show>
          </A>
        </div>

        {/* Details */}
        <Show when={!(props.settings?.noauthor && props.settings?.nodate)}>
          {/* Author and Date */}
          <div
            class={clsx(styles.shoutDetails, { [styles.shoutDetailsFeedMode]: props.settings?.isFeedMode })}
          >
            <Show when={!props.settings?.noauthor}>
              <div class={styles.shoutAuthor}>
                <For each={props.article.authors}>
                  {(a: Maybe<Author>) => (
                    <AuthorLink
                      size={'XS'}
                      author={a as Author}
                      isFloorImportant={Boolean(
                        props.settings?.isFloorImportant || props.settings?.isWithCover
                      )}
                    />
                  )}
                </For>
              </div>
            </Show>
            <Show when={!props.settings?.nodate}>
              <time class={styles.shoutDate}>{formattedDate()}</time>
            </Show>
          </div>
        </Show>

        {/* Description */}
        <Show when={props.article.description}>
          <section class={styles.shoutCardDescription} innerHTML={props.article.description || ''} />
        </Show>
        <Show when={props.settings?.isFeedMode}>
          <Show when={props.article.description}>
            <section class={styles.shoutCardDescription} innerHTML={props.article.description || ''} />
          </Show>
          <Show when={!props.settings?.noimage && props.article.cover}>
            <div class={styles.shoutCardCoverContainer}>
              <Show
                when={
                  props.article.layout &&
                  props.article.layout !== 'article' &&
                  !(props.settings?.noicon || props.settings?.noimage)
                }
              >
                <div class={styles.shoutCardType}>
                  <A href={`/expo/${props.article.layout}`}>
                    <Icon name={props.article.layout} class={styles.icon} />
                  </A>
                </div>
              </Show>
              <div class={styles.shoutCardCover}>
                <Image src={props.article.cover || ''} alt={title} width={600} loading="lazy" />
              </div>
            </div>
          </Show>

          <section
            class={styles.shoutCardDetails}
            classList={{ [styles.shoutCardDetailsActive]: isActionPopupActive() }}
          >
            <div class={styles.shoutCardDetailsContent}>
              <RatingControl
                shout={props.article}
                class={styles.shoutCardDetailsItem}
                myRate={props.myRate}
              />

              <div class={clsx(styles.shoutCardDetailsItem, styles.shoutCardComments)}>
                <a href="#" onClick={(event) => scrollToComments(event)}>
                  <Icon name="comment" class={clsx(styles.icon, styles.feedControlIcon)} />
                  <Icon
                    name="comment-hover"
                    class={clsx(styles.icon, styles.iconHover, styles.feedControlIcon)}
                  />
                  <Show
                    when={props.article.stat?.commented}
                    fallback={
                      <span class={clsx(styles.shoutCardLinkContainer, styles.shoutCardDetailsItemLabel)}>
                        {t('Add comment')}
                      </span>
                    }
                  >
                    {props.article.stat?.commented}
                  </Show>
                </a>
              </div>

              <Show when={props.settings?.withViewed}>
                <div class={clsx(styles.shoutCardDetailsItem, styles.shoutCardDetailsViewed)}>
                  <Icon name="eye" class={clsx(styles.icon, styles.feedControlIcon)} />
                  {props.article.stat?.viewed}
                </div>
              </Show>
            </div>

            <div class={styles.shoutCardDetailsContent}>
              <Show when={canEdit()}>
                <Popover content={t('Edit')} disabled={isActionPopupActive()}>
                  {(triggerRef: (el: HTMLElement) => void) => (
                    <div class={styles.shoutCardDetailsItem} ref={triggerRef}>
                      <A href={`/edit/${props.article.id}`}>
                        <Icon name="pencil-outline" class={clsx(styles.icon, styles.feedControlIcon)} />
                        <Icon
                          name="pencil-outline-hover"
                          class={clsx(styles.icon, styles.iconHover, styles.feedControlIcon)}
                        />
                      </A>
                    </div>
                  )}
                </Popover>
              </Show>

              <Popover content={t('Add to bookmarks')} disabled={isActionPopupActive()}>
                {(triggerRef: (el: HTMLElement) => void) => (
                  <div class={styles.shoutCardDetailsItem} ref={triggerRef}>
                    <button>
                      <Icon name="bookmark" class={clsx(styles.icon, styles.feedControlIcon)} />
                      <Icon
                        name="bookmark-hover"
                        class={clsx(styles.icon, styles.iconHover, styles.feedControlIcon)}
                      />
                    </button>
                  </div>
                )}
              </Popover>

              <Popover content={t('Share')} disabled={isActionPopupActive()}>
                {(triggerRef: (el: HTMLElement) => void) => (
                  <div class={styles.shoutCardDetailsItem} ref={triggerRef}>
                    <SharePopup
                      containerCssClass={stylesHeader.control}
                      title={title}
                      description={description}
                      imageUrl={props.article.cover || ''}
                      shareUrl={getShareUrl({ pathname: `/${props.article.slug}` })}
                      onVisibilityChange={(isVisible) => setIsActionPopupActive(isVisible)}
                      trigger={
                        <button>
                          <Icon name="share-outline" class={clsx(styles.icon, styles.feedControlIcon)} />
                          <Icon
                            name="share-outline-hover"
                            class={clsx(styles.icon, styles.iconHover, styles.feedControlIcon)}
                          />
                        </button>
                      }
                    />
                  </div>
                )}
              </Popover>

              <div class={styles.shoutCardDetailsItem}>
                <FeedArticlePopup
                  canEdit={Boolean(canEdit())}
                  containerCssClass={stylesHeader.control}
                  onShareClick={() => props.onShare?.(props.article)}
                  onInviteClick={onInvite}
                  onVisibilityChange={(isVisible) => setIsActionPopupActive(isVisible)}
                  trigger={
                    <button>
                      <Icon name="ellipsis" class={clsx(styles.icon, styles.feedControlIcon)} />
                      <Icon
                        name="ellipsis"
                        class={clsx(styles.icon, styles.iconHover, styles.feedControlIcon)}
                      />
                    </button>
                  }
                />
              </div>
            </div>
          </section>
        </Show>
      </div>
    </section>
  )
}
