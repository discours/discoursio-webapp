import { A, createAsync, useLocation, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createEffect, createSignal, on } from 'solid-js'
import { DropDown } from '~/components/_shared/DropDown'
import { Option, OptionGroup } from '~/components/_shared/DropDown/DropDown'
import { Icon } from '~/components/_shared/Icon'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Loading } from '~/components/_shared/Loading'
import { ShareModal } from '~/components/_shared/ShareModal'
import { useAuthors } from '~/context/authors'
import { EXPO_LAYOUTS, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useReactions } from '~/context/reactions'
import { useSession } from '~/context/session'
import { useTopics } from '~/context/topics'
import { useUI } from '~/context/ui'
import { loadUnratedShouts } from '~/graphql/api/public'
import { loadShouts } from '~/graphql/api/public'
import type { Author, Shout } from '~/graphql/schema/core.gen'
import { ReactionKind } from '~/graphql/schema/core.gen'
import { ExpoLayoutType } from '~/types/common'
import { capitalize } from '~/utils/capitalize'
import { CommentDate } from '../Article/CommentDate'
import { getShareUrl } from '../Article/SharePopup'
import { AuthorBadge } from '../Author/AuthorBadge'
import { AuthorLink } from '../Author/AuthorLink'
import { ArticleCard } from '../Feed/ArticleCard'
import { Placeholder } from '../Feed/Placeholder'
import { Sidebar } from '../Feed/Sidebar'
import { Modal } from '../_shared/Modal'

import { PeriodType, getFromDate } from '~/lib/fromPeriod'
import styles from '~/styles/views/Feed.module.scss'
import stylesBeside from '../Feed/Beside.module.scss'
import stylesTopic from '../Feed/CardTopic.module.scss'

export const FEED_PAGE_SIZE = 20
export type FeedMode = 'featured' | 'not featured' | 'all'
export type ShoutsOrder = 'recent' | 'likes' | 'hot'

export type FeedProps = {
  mode?: FeedMode
  order?: ShoutsOrder
}

export const FeedView = (props: FeedProps) => {
  const { t } = useLocalize()
  const loc = useLocation()
  const navigate = useNavigate()
  const { showModal } = useUI()
  const { loadReactionsBy } = useReactions()
  const { topTopics } = useTopics()
  const { topAuthors } = useAuthors()
  const { session } = useSession()

  const unrated = createAsync(async () => {
    const fetcher = loadUnratedShouts({ limit: 5 })
    const result = await fetcher()
    return result
  })

  const recentComments = createAsync(
    async () => await loadReactionsBy({ by: { kinds: [ReactionKind.Comment] }, limit: 10 })
  )

  // context-wise feed
  const { feed, addFeed } = useFeed()

  // filters
  const [mode, setMode] = createSignal<FeedMode>(props.mode || 'all')
  const [layoutsFilter, setLayoutsFilter] = createSignal<Array<ExpoLayoutType | 'article'>>([])
  const [currentPeriod, setCurrentPeriod] = createSignal<PeriodType>('all time')
  // loading state
  const [isLoading, setIsLoading] = createSignal(false)
  const [isRightColumnLoaded, setIsRightColumnLoaded] = createSignal(false)
  const [shareData, setShareData] = createSignal<Shout | undefined>()

  // 1 filter changes quering observer
  createEffect(
    on(
      [mode, layoutsFilter, currentPeriod],
      ([m, layouts, period]) => {
        setIsLoading(true)
        const filters: { layouts?: Array<ExpoLayoutType | 'article'>; after?: number; featured?: boolean } =
          {
            layouts
          }
        if (period) {
          const after = getFromDate(period as PeriodType)
          if (after) {
            filters.after = after
          }
        }
        if (m !== 'all') filters.featured = m === 'featured'
        console.debug('[views.feed] filter changed', filters)
        const shoutsLoader = loadShouts({ filters, limit: FEED_PAGE_SIZE })
        shoutsLoader().then(addFeed)
      },
      { defer: true }
    )
  )

  // 2 post-load reactions
  createEffect(
    on(
      feed, // here should be a current feed
      (sss?: Shout[]) => {
        if (sss && Array.isArray(sss)) {
          setIsLoading(true)
          Promise.all([
            loadReactionsBy({ by: { kinds: [ReactionKind.Comment] }, limit: 10 }), // comments on all shouts
            loadReactionsBy({ by: { shouts: sss.map((s: Shout) => s.slug) } }) // reactions on feed shouts
          ]).finally(() => {
            console.debug('[views.feed] finally loaded reactions, data loading finished')
            setIsRightColumnLoaded(true)
            setIsLoading(false)
          })
        }
      },
      { defer: true }
    )
  )

  const handleShare = (shared: Shout | undefined) => {
    showModal('share')
    setShareData(shared)
  }

  const asOption = (o: string): Option => {
    const isPeriod = ['all time', 'day', 'week', 'month', 'year'].includes(o)
    const value = isPeriod ? Math.floor(Date.now() / 1000) - getFromDate(o as PeriodType) : o
    return { value, title: t(capitalize(o)) }
  }
  const asOptionsGroup = (
    opts: string[],
    title?: string,
    onChange?: (option: Option) => void
  ): OptionGroup | Option[] => {
    const options = opts.map(asOption)
    return onChange
      ? ({
          title,
          options,
          currentOption: options[0],
          onChange
        } as OptionGroup)
      : (options as Option[])
  }

  return (
    <div class={clsx('wide-container', styles.feed)}>
      <div class="row">
        <div class={clsx('col-md-5 col-xl-4', styles.feedNavigation)}>
          <Sidebar />
        </div>

        <div class="col-md-12 offset-xl-1">
          <Show when={!session() && loc?.pathname !== 'feed'}>
            <Placeholder type={loc?.pathname} mode="feed" />
          </Show>

          <Show when={(session() || loc?.pathname === 'feed') && feed()}>
            <div class={styles.filtersContainer}>
              <ul class={clsx('view-switcher', styles.feedFilter)}>
                <li
                  class={clsx({
                    'view-switcher__item--selected': !props.order || props.order === 'recent'
                  })}
                >
                  <A href={`/feed/${props.mode}/recent`}>{t('Recent')}</A>
                </li>
                <li class={clsx({ 'view-switcher__item--selected': props.order === 'likes' })}>
                  <A class="link" href={`/feed/${props.mode}/likes`}>
                    {t('Liked')}
                  </A>
                </li>
                <li
                  class={clsx({
                    'view-switcher__item--selected': props.order === 'hot'
                  })}
                >
                  <A class="link" href={`/feed/${props.mode}/hot`}>
                    {t('Commented')}
                  </A>
                </li>
              </ul>
              <div class={styles.dropdowns}>
                <DropDown
                  popupProps={{ horizontalAnchor: 'right' }}
                  options={asOptionsGroup(Object.values(PeriodType)) as Option[]}
                  currentOption={asOption(currentPeriod() || 'all time')}
                  triggerCssClass={styles.periodSwitcher}
                  onChange={(opt: Option) => setCurrentPeriod(opt.title.toLowerCase() as PeriodType)}
                />
                <DropDown
                  popupProps={{ horizontalAnchor: 'right' }}
                  options={[
                    asOptionsGroup(['all', 'featured', 'not featured'], '', (opt: Option) =>
                      setMode(opt.value as FeedMode)
                    ) as OptionGroup,
                    asOptionsGroup(
                      ['all', 'article', ...EXPO_LAYOUTS],
                      t(layoutsFilter() || 'Layouts') as string,
                      (opt: Option) =>
                        setLayoutsFilter((prev) => [...prev, opt.value as ExpoLayoutType | 'article'])
                    ) as OptionGroup
                  ]}
                  currentOption={asOption(props.mode || 'all')}
                  triggerCssClass={styles.periodSwitcher}
                  onChange={(mode: Option) => navigate(`/feed/${mode.value}`)}
                />
              </div>
            </div>

            <Show when={!isLoading()} fallback={<Loading />}>
              <Show when={(feed() || []).length > 0}>
                <For each={(feed() || []).slice(0, 4)}>
                  {(article) => (
                    <ArticleCard
                      onShare={(shared) => handleShare(shared)}
                      onInvite={() => showModal('inviteMembers')}
                      article={article}
                      settings={{ isFeedMode: true }}
                      desktopCoverSize="M"
                    />
                  )}
                </For>

                <div class={styles.asideSection}>
                  <div class={stylesBeside.besideColumnTitle}>
                    <h4>{t('Popular authors')}</h4>
                    <a href="/author">
                      {t('All authors')}
                      <Icon name="arrow-right" class={stylesBeside.icon} />
                    </a>
                  </div>

                  <ul class={stylesBeside.besideColumn}>
                    <For each={topAuthors().slice(0, 5)}>
                      {(author) => (
                        <li>
                          <AuthorBadge author={author} />
                        </li>
                      )}
                    </For>
                  </ul>
                </div>

                <For each={(feed() || []).slice(4)}>
                  {(article) => (
                    <ArticleCard article={article} settings={{ isFeedMode: true }} desktopCoverSize="M" />
                  )}
                </For>
              </Show>
            </Show>
          </Show>
        </div>

        <aside class={clsx('col-md-7 col-xl-6 offset-xl-1', styles.feedAside)}>
          <Show when={isRightColumnLoaded()}>
            <Show when={recentComments()}>
              <section class={styles.asideSection}>
                <h4>{t('Comments')}</h4>
                <For each={recentComments()}>
                  {(comment) => {
                    return (
                      <div class={styles.comment}>
                        <div class={clsx('text-truncate', styles.commentBody)}>
                          <A
                            href={`/${comment.shout.slug}?commentId=${comment.id}`}
                            innerHTML={comment.body || ''}
                          />
                        </div>
                        <div class={styles.commentDetails}>
                          <AuthorLink author={comment.created_by as Author} size={'XS'} />
                          <CommentDate comment={comment} isShort={true} isLastInRow={true} />
                        </div>
                        <div class={clsx('text-truncate', styles.commentArticleTitle)}>
                          <A href={`/${comment.shout.slug}`}>{comment.shout.title}</A>
                        </div>
                      </div>
                    )
                  }}
                </For>
              </section>
            </Show>

            <Show when={topTopics().length > 0}>
              <section class={styles.asideSection}>
                <h4>{t('Hot topics')}</h4>
                <For each={topTopics().slice(0, 7)}>
                  {(topic) => (
                    <span class={clsx(stylesTopic.shoutTopic, styles.topic)}>
                      <A href={`/topic/${topic.slug}`}>{topic.title}</A>{' '}
                    </span>
                  )}
                </For>
              </section>
            </Show>

            <section class={clsx(styles.asideSection, styles.pinnedLinks)}>
              <h4>{t('Knowledge base')}</h4>
              <ul class="nodash">
                <li>
                  <A href="/guide">{t('How Discours works')}</A>
                </li>
                <li>
                  <A href="/how-to-write-a-good-article">{t('How to write a good article')}</A>
                </li>
                <li>
                  <A href="/rules">{t('Rules of constructive discussions')}</A>
                </li>
                <li>
                  <A href="/principles">{t('Community principles')}</A>
                </li>
              </ul>
            </section>

            <Show when={unrated?.()}>
              <section class={clsx(styles.asideSection)}>
                <h4>{t('Be the first to rate')}</h4>
                <For each={unrated() as Shout[]}>
                  {(article) => (
                    <ArticleCard article={article} settings={{ noimage: true, nodate: true }} />
                  )}
                </For>
              </section>
            </Show>
          </Show>
        </aside>
      </div>
      <Show when={shareData()}>
        <ShareModal
          title={shareData()?.title || ''}
          description={shareData()?.description || ''}
          imageUrl={shareData()?.cover || ''}
          shareUrl={getShareUrl({ pathname: `/${shareData()?.slug || ''}` })}
        />
      </Show>

      <Modal variant="medium" name="inviteCoauthors">
        <InviteMembers variant={'coauthors'} title={t('Invite experts')} />
      </Modal>
    </div>
  )
}
