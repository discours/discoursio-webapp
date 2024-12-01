import { A, useNavigate, useParams } from '@solidjs/router'
import { For, Suspense, createEffect, createSignal, on } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { Loading } from '~/components/_shared/Loading'
import { useAuthors } from '~/context/authors'
import { useFeed } from '~/context/feed'
import { useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useTopics } from '~/context/topics'
import { Author, Topic } from '~/graphql/schema/core.gen'
import { FeedMode } from '~/types/filters'
import { Userpic } from '../../Author/Userpic'
import styles from './Sidebar.module.scss'

export const Sidebar = () => {
  const { t } = useLocalize()
  const { follows } = useFollowing()
  const { session } = useSession()
  const { feedByTopic, feedByAuthor, seen } = useFeed()
  const { authorsEntities } = useAuthors()
  const { topicEntities, topTopics } = useTopics()
  const navigate = useNavigate()

  const [selected, setSelected] = createSignal('all')
  const [authorsList, setAuthorsList] = createSignal<Partial<Author>[]>([])
  const [topicsList, setTopicsList] = createSignal<Partial<Topic>[]>([])

  // Обновляем selected при изменении параметров URL
  const params = useParams()
  createEffect(() => setSelected(params.mode || 'recent'))

  // Объединенный эффект для обработки авторов и топиков
  createEffect(
    on(
      [
        feedByAuthor,
        feedByTopic,
        () => follows,
        () => session()?.access_token,
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
          const availableTopics = topicsSlugs.map((slug) => topics[slug]).filter(Boolean)

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
  const handleModeSwitch = (mode: FeedMode, path: string) => {
    // Если режим "recent", то используем корневой путь /feed
    const targetPath = mode && mode !== 'recent' ? path : '/feed'
    navigate(targetPath)
    setSelected(mode)
  }

  return (
    <div class={styles.sidebar}>
      <nav class={styles.feedFilters}>
        <A
          href="/feed"
          onClick={(e) => {
            e.preventDefault()
            handleModeSwitch('recent', '/feed')
          }}
          classList={{ [styles.selected]: selected() === 'recent' }}
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
            handleModeSwitch('followed', '/feed/followed')
          }}
          classList={{ [styles.selected]: selected() === 'followed' }}
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
            handleModeSwitch('coauthored', '/feed/coauthored')
          }}
          classList={{ [styles.selected]: selected() === 'coauthored' }}
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
            handleModeSwitch('discussed', '/feed/discussed')
          }}
          classList={{ [styles.selected]: selected() === 'discussed' }}
        >
          <div class={styles.sidebarItemName}>
            <Icon name="feed-discussion" class={styles.icon} />
            <span class={styles.sidebarItemNameLabel}>{t('Discussions')}</span>
          </div>
        </A>
      </nav>

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
