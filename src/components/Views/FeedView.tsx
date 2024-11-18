import { A, useLocation } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, Suspense, createSignal } from 'solid-js'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Loading } from '~/components/_shared/Loading'
import { ShareModal } from '~/components/_shared/ShareModal'
import { useAuthors } from '~/context/authors'
import { useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { ModalType, useUI } from '~/context/ui'
import { Author, Shout } from '~/graphql/schema/core.gen'
import { Reaction } from '~/graphql/schema/core.gen'
import { getFileUrl } from '~/lib/getThumbUrl'
import styles from '~/styles/views/Feed.module.scss'
import { CommentDate } from '../Article/CommentDate'
import { getShareUrl } from '../Article/SharePopup'
import { AuthorLink } from '../Author/AuthorLink'
import { ArticleCard } from '../Feed/ArticleCard'
import { FeedFilters } from '../Feed/FeedFilters'
import { ViewSwitcher } from '../Feed/FeedSwitcher/FeedSwitcher'
import { Placeholder } from '../Feed/Placeholder'
import { Sidebar } from '../Feed/Sidebar'
import { Modal } from '../_shared/Modal'

export interface FeedProps {
  shouts: Shout[]
  unratedShouts: Shout[]
  recentComments: Reaction[]
}

export const FeedView = (props: FeedProps) => {
  const { t } = useLocalize()
  const loc = useLocation()
  const { showModal } = useUI()
  const { session } = useSession()
  const { feed, isFeedLoading } = useFeed()

  // Состояние для хранения данных для шаринга
  const [shareData, setShareData] = createSignal<Shout | undefined>()
  const handleShare = (shared: Shout | undefined) => {
    showModal('share')
    setShareData(shared)
  }

  // Компонент для рендеринга статей
  const ArticlesList = (props: { articles: Shout[] }) => {
    const { topAuthors } = useAuthors()
    const TopAuthorsList = () => (
      <section class={styles.asideSection}>
        <h4>{t('Top authors')}</h4>
        <For each={topAuthors() || []}>{(author) => <AuthorLink author={author} size={'XS'} />}</For>
      </section>
    )
    return (
      <>
        <For each={props.articles}>
          {(article, index) => (
            <>
              {index() === 5 && <TopAuthorsList />}
              <ArticleCard
                article={article}
                settings={{ isFeedMode: true }}
                desktopCoverSize="M"
                onShare={handleShare}
                onInvite={() => showModal('inviteCoauthors' as ModalType)}
              />
            </>
          )}
        </For>
      </>
    )
  }

  // Компонент для комментариев
  const FreshestCommentsList = () => (
    <Show when={props.recentComments?.length}>
      <section class={styles.asideSection}>
        <h4>{t('Comments')}</h4>
        <For each={props.recentComments || []}>
          {(comment) => {
            const suffix = comment.id ? `?commentId=${comment.id}` : ''
            return (
              <div class={styles.comment} id={`comment-${comment.id}`}>
                <div class={clsx('text-truncate', styles.commentBody)}>
                  <A href={`/${comment.shout.slug}${suffix}`} innerHTML={comment.body || ''} />
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
  )

  // После TopicsList добавляем новый компонент
  const UnratedArticlesList = () => {
    return (
      <Show when={props.unratedShouts?.length}>
        <section class={styles.asideSection}>
          <h4>{t('Be the first to rate')}</h4>
          <For each={props.unratedShouts || []}>
            {(article) => (
              <div
                class={clsx(styles.comment, styles.unratedArticle)}
                style={{
                  'background-image': `url(${getFileUrl(article.cover || '', { width: 40 })})`
                }}
              >
                <Show when={article.main_topic}>
                  <A href={`/topic/${article.main_topic?.slug}`} class={styles.commentTopic}>
                    {article.main_topic?.title?.toUpperCase()}
                  </A>
                </Show>

                <div class={clsx('text-truncate', styles.commentBody)}>
                  <A href={`/${article.slug}`}>{article.title}</A>
                  <Show when={article.subtitle || article.lead}>
                    <p class={styles.commentText}>{article.subtitle || article.lead}</p>
                  </Show>
                </div>

                <div class={styles.commentDetails}>
                  <AuthorLink author={article.created_by as Author} size={'XS'} />
                </div>
              </div>
            )}
          </For>
        </section>
      </Show>
    )
  }

  return (
    <Suspense fallback={<Loading />}>
      <Show when={props.shouts} fallback={<Loading />}>
        <div class="wide-container">
          <div class={clsx('row')}>
            {/* Sidebar с Suspense */}
            <Suspense fallback={<Loading />}>
              <div class={clsx('col-md-5 col-xl-4', styles.feedNavigation)}>
                <Sidebar />
              </div>
            </Suspense>

            {/* Основной контент - исправляем структуру и классы */}
            <div class="col-md-12 col-xl-7 offset-xl-1">
              <Show
                when={session() || loc.pathname.includes('feed')}
                fallback={<Placeholder type={loc.pathname} mode="feed" />}
              >
                <div class={styles.filtersContainer}>
                  <ViewSwitcher options={['recent', 'top', 'hot']} prefix={'/feed'} />
                  <FeedFilters />
                </div>

                <Show when={!isFeedLoading()} fallback={<Loading />}>
                  <Show
                    when={feed()?.length > 0}
                    fallback={<div class={styles.noContent}>{t('No articles found')}</div>}
                  >
                    <div class={styles.feedContent}>
                      <div class={styles.feedPage}>
                        <div class={styles.mainArticles}>
                          <ArticlesList articles={props.shouts} />
                        </div>
                      </div>
                    </div>
                  </Show>
                </Show>
              </Show>
            </div>

            {/* Боковая панель */}
            <aside class={clsx('col-md-7 col-xl-4', styles.feedAside)}>
              <Show when={!isFeedLoading()}>
                <Suspense fallback={<Loading />}>
                  <FreshestCommentsList />
                  <UnratedArticlesList />
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
                </Suspense>
              </Show>
            </aside>
          </div>

          {/* Модальные окна */}
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
      </Show>
    </Suspense>
  )
}
