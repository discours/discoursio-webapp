import { A } from '@solidjs/router'
import { For, Show, Suspense, batch, createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
import { checkStorageQuota, performPeriodicCleanup } from '~/components/SimpleRichEditor/lib/storage'
import { Icon } from '~/components/_shared/Icon'
import { Loading } from '~/components/_shared/Loading'
import { useAuthors } from '~/context/authors'
import { useFeed } from '~/context/feed'
import { useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useTopics } from '~/context/topics'
import { Author, Topic } from '~/graphql/schema/core.gen'
import { MyFeedKind } from '~/types/nav'
import { Userpic } from '../../Author/Userpic'
import styles from './Sidebar.module.scss'

export const Sidebar = () => {
  const { t } = useLocalize()
  const { follows } = useFollowing()
  const { session } = useSession()
  const {
    feedByTopic,
    feedByAuthor,
    seen,
    myFeed,
    setMyFeed,
    setFollowedFeed,
    setDiscussedFeed,
    setCoauthoredFeed
  } = useFeed()
  const { authorsEntities } = useAuthors()
  const { topicEntities, topTopics } = useTopics()
  const [authorsList, setAuthorsList] = createSignal<Partial<Author>[]>([])
  const [topicsList, setTopicsList] = createSignal<Partial<Topic>[]>([])

  // Offline статус
  const [networkStatus, setNetworkStatus] = createSignal(navigator.onLine)
  const [storageQuota, setStorageQuota] = createSignal(checkStorageQuota())
  const [isOfflineExpanded, setIsOfflineExpanded] = createSignal(false)

  // Обновление статуса сети
  const handleNetworkChange = () => {
    setNetworkStatus(navigator.onLine)
  }

  // Обновление данных хранилища
  const updateStorageInfo = () => {
    setStorageQuota(checkStorageQuota())
  }

  // Cleanup старых черновиков
  const handleCleanup = () => {
    const deletedCount = performPeriodicCleanup(true)
    console.log(`[Sidebar] Manually cleaned up ${deletedCount} drafts`)
    updateStorageInfo()
  }

  onMount(() => {
    // Слушатели событий сети
    window.addEventListener('online', handleNetworkChange)
    window.addEventListener('offline', handleNetworkChange)

    // Периодическое обновление данных
    const updateInterval = setInterval(updateStorageInfo, 10000)

    onCleanup(() => {
      window.removeEventListener('online', handleNetworkChange)
      window.removeEventListener('offline', handleNetworkChange)
      clearInterval(updateInterval)
    })
  })

  // Объединенный эффект для обработки авторов и топиков
  createEffect(
    on(
      [
        feedByAuthor,
        feedByTopic,
        () => follows,
        () => session()?.token,
        () => authorsEntities(),
        () => topicEntities(),
        () => topTopics()
      ],
      ([fba, ft, followsData, isLoggedIn, authors, topics, topTopicsList], prev) => {
        // Проверяем, действительно ли изменились данные
        if (prev && JSON.stringify([fba, ft]) === JSON.stringify([prev[0], prev[1]])) {
          return
        }

        const loggedIn = Boolean(isLoggedIn)

        // Обработка авторов
        if (loggedIn && followsData?.authors?.length) {
          setAuthorsList(
            followsData.authors.map((author) => ({
              ...author,
              isUnread: false,
              key: `author-${author.slug}`
            }))
          )
        } else if (fba && authors) {
          const authorsSlugs = Object.keys(fba).filter((slug) => fba[slug]?.length > 0)
          setAuthorsList(
            authorsSlugs
              .map((slug) => authors[slug])
              .filter(Boolean)
              .map((author) => ({
                ...author,
                isUnread: fba[author.slug]?.some((article) => !seen()[article.slug]),
                key: `author-${author.slug}`
              }))
          )
        }

        // Обработка топиков
        if (loggedIn && followsData?.topics?.length) {
          setTopicsList(
            followsData.topics.map((topic) => ({
              ...topic,
              isUnread: false,
              key: `topic-${topic.slug}`
            }))
          )
        } else if (ft && topics) {
          const topicsSlugs = Object.keys(ft).filter((slug) => ft[slug]?.length > 0)
          const availableTopics = Object.values(topics).filter((t: Topic) => topicsSlugs.includes(t.slug))

          setTopicsList(
            availableTopics.length
              ? availableTopics.map((topic) => ({
                  ...topic,
                  isUnread: ft[topic.slug]?.some((article) => !seen()[article.slug]),
                  key: `topic-${topic.slug}`
                }))
              : topTopicsList?.slice(0, 9).map((topic) => ({
                  ...topic,
                  isUnread: false,
                  key: `topic-${topic.slug}`
                }))
          )
        }
      },
      { defer: true }
    )
  )

  // Упрощенный обработчик для переключения режимов
  const handleMyFeedSwitch = (type: MyFeedKind) => {
    batch(() => {
      setMyFeed(type)
      // Сбрасываем текущий фид при переключении
      switch (type) {
        case 'followed': {
          setFollowedFeed({ shouts: [], isLoading: true, hasMore: false })
          break
        }
        case 'discussed': {
          setDiscussedFeed({ shouts: [], isLoading: true, hasMore: false })
          break
        }
        case 'coauthored': {
          setCoauthoredFeed({ shouts: [], isLoading: true, hasMore: false })
          break
        }
        default: {
          setMyFeed(undefined)
        }
      }
    })
  }

  return (
    <div class={styles.sidebar}>
      <nav class={styles.feedFilters}>
        <A
          href="/feed"
          onClick={(e) => {
            e.preventDefault()
            handleMyFeedSwitch(undefined)
          }}
          classList={{ [styles.selected]: !myFeed() }}
        >
          <div class={styles.sidebarItemName}>
            <Icon name="feed-all" class={styles.icon} />
            <span class={styles.sidebarItemNameLabel}>{t('All')}</span>
          </div>
        </A>

        <A
          href="/feed/followed"
          onClick={(e) => {
            e.preventDefault()
            handleMyFeedSwitch('followed')
          }}
          classList={{ [styles.selected]: myFeed() === 'followed' }}
        >
          <div class={styles.sidebarItemName}>
            <Icon name="feed-my" class={styles.icon} />
            <span class={styles.sidebarItemNameLabel}>{t('My feed')}</span>
          </div>
        </A>

        <A
          href="/feed/coauthored"
          onClick={(e) => {
            e.preventDefault()
            handleMyFeedSwitch('coauthored')
          }}
          classList={{ [styles.selected]: myFeed() === 'coauthored' }}
        >
          <div class={styles.sidebarItemName}>
            <Icon name="feed-collaborate" class={styles.icon} />
            <span class={styles.sidebarItemNameLabel}>{t('Participation')}</span>
          </div>
        </A>

        <A
          href="/feed/discussed"
          onClick={(e) => {
            e.preventDefault()
            handleMyFeedSwitch('discussed')
          }}
          classList={{ [styles.selected]: myFeed() === 'discussed' }}
        >
          <div class={styles.sidebarItemName}>
            <Icon name="feed-discussion" class={styles.icon} />
            <span class={styles.sidebarItemNameLabel}>{t('Discussions')}</span>
          </div>
        </A>
      </nav>

      {/* Offline Status Section - всегда показываем */}
      <section class={styles.offlineSection}>
        <div
          class={styles.sidebarItem}
          classList={{
            [styles.offlineAlert]: !networkStatus(),
            [styles.storageWarning]: storageQuota().warning && networkStatus(),
            [styles.onlineStatus]: networkStatus() && !storageQuota().warning
          }}
          onClick={() => setIsOfflineExpanded(!isOfflineExpanded())}
        >
          <div class={styles.sidebarItemName}>
            <Icon
              name={
                networkStatus() ? (storageQuota().warning ? 'alert-triangle' : 'check-circle') : 'wifi-off'
              }
              class={styles.icon}
            />
            <span class={styles.sidebarItemNameLabel}>
              {networkStatus()
                ? storageQuota().warning
                  ? t('Storage warning')
                  : t('All synced')
                : t('Offline mode')}
            </span>
            <Icon name={isOfflineExpanded() ? 'chevron-up' : 'chevron-down'} class={styles.expandIcon} />
          </div>
        </div>

        <Show when={isOfflineExpanded()}>
          <div class={styles.offlineDetails}>
            <Show when={!networkStatus()}>
              <p class={styles.offlineMessage}>{t('Changes will be saved when connection is restored')}</p>
            </Show>

            {/* Всегда показываем информацию о хранилище */}
            <div class={styles.storageInfo}>
              <div class={styles.storageBar}>
                <div
                  class={styles.storageProgress}
                  style={{
                    width: `${Math.min(storageQuota().percentage * 100, 100)}%`
                  }}
                />
              </div>
              <span class={styles.storageText}>
                {Math.round(storageQuota().used / 1024)} KB / {Math.round(storageQuota().total / 1024)} KB (
                {Math.round(storageQuota().percentage * 100)}%)
              </span>
            </div>

            <button type="button" onClick={handleCleanup} class={styles.cleanupButton}>
              <Icon name="trash-2" class={styles.icon} />
              {t('Cleanup old drafts')}
            </button>
          </div>
        </Show>
      </section>

      <section>
        <hr />
        <Suspense fallback={<Loading />}>
          <ul class={styles.subscriptions}>
            <For each={authorsList() as Partial<Author & { key: string; isUnread: boolean }>[]}>
              {(author) => (
                <li id={author.key}>
                  <a
                    href={`/@${author.slug}`}
                    class={styles.sidebarItem}
                    classList={{ [styles.unread]: author.isUnread }}
                  >
                    <div class={styles.sidebarItemName}>
                      <Userpic
                        name={author.name || ''}
                        userpic={author.pic || ''}
                        size="XS"
                        class={styles.userpic}
                      />
                      <span class={styles.sidebarItemNameLabel}>{author.name}</span>
                    </div>
                  </a>
                </li>
              )}
            </For>
            <For each={topicsList() as Partial<Topic & { key: string; isUnread: boolean }>[]}>
              {(topic) => (
                <li id={topic.key}>
                  <a
                    href={`/topic/${topic.slug}`}
                    class={styles.sidebarItem}
                    classList={{ [styles.unread]: topic.isUnread }}
                  >
                    <div class={styles.sidebarItemName}>
                      <Icon name="hash" class={styles.icon} />
                      <span class={styles.sidebarItemNameLabel}>{topic.title}</span>
                    </div>
                  </a>
                </li>
              )}
            </For>
          </ul>
        </Suspense>
      </section>

      <footer class={styles.settings}>
        <a href="/profile/subs" class={styles.sidebarItem}>
          <div class={styles.sidebarItemName}>
            <Icon name="settings" class={styles.icon} />
            <span class={styles.sidebarItemNameLabel}>{t('Feed settings')}</span>
          </div>
        </a>
      </footer>
    </div>
  )
}
