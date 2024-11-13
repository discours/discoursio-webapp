import { A, useParams } from '@solidjs/router'
import { For, createEffect, createSignal, on } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { useAuthors } from '~/context/authors'
import { useFeed } from '~/context/feed'
import { useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useTopics } from '~/context/topics'
import { Author, Topic } from '~/graphql/schema/core.gen'
import { Userpic } from '../../Author/Userpic'
import styles from './Sidebar.module.scss'

export const Sidebar = () => {
  const { t } = useLocalize()
  const { follows } = useFollowing()
  const { session } = useSession()
  const { feedByTopic, feedByAuthor, seen } = useFeed()
  const { authorsEntities } = useAuthors()
  const { topicEntities, topTopics } = useTopics()
  const [selected, setSelected] = createSignal('all')
  const params = useParams()
  createEffect(() => setSelected(params.mode || 'all'))
  const [authorsList, setAuthorsList] = createSignal<Partial<Author>[]>([])

  createEffect(
    on(
      [
        feedByAuthor,
        () => follows?.authors,
        () => Boolean(session()?.access_token),
        () => authorsEntities()
      ],
      ([fba, followsAuthors, loggedIn, authors]) => {
        console.log('Feed by author effect:', { fba, authors, loggedIn })

        // Для незалогиненных пользователей или без подписок
        if (!(loggedIn && followsAuthors?.length)) {
          if (fba && authors) {
            const authorsSlugs = Object.keys(fba).filter((slug) => fba[slug]?.length > 0)
            console.log('Available authors:', authorsSlugs)
            const authorsList = authorsSlugs
              .map((slug) => authors[slug])
              .filter(Boolean)
              .map((author) => ({
                ...author,
                isUnread: fba[author.slug]?.some((article) => !seen()[article.slug]),
                key: `author-${author.slug}`
              }))
            setAuthorsList(authorsList)
          }
          return
        }

        // Для залогиненных с подписками
        if (loggedIn && followsAuthors?.length) {
          const followedAuthors = followsAuthors.map((author: Author) => ({
            ...author,
            isUnread: false,
            key: `author-${author.slug}`
          }))
          setAuthorsList(followedAuthors)
        }
      },
      { defer: true }
    )
  )

  const [topicsList, setTopicsList] = createSignal<Partial<Topic>[]>([])

  createEffect(
    on(
      [feedByTopic, () => follows?.topics, () => Boolean(session()?.access_token), () => topicEntities()],
      ([ft, followsTopics, loggedIn, topics]) => {
        console.log('Feed by topic effect:', { ft, topics, loggedIn })

        // Для незалогиненных пользователей или без подписок
        if (!(loggedIn && followsTopics?.length)) {
          if (ft && topics) {
            const topicsSlugs = Object.keys(ft).filter((slug) => ft[slug]?.length > 0)
            console.log('Available topics:', topicsSlugs)
            let topicsList = topicsSlugs.map((slug) => topics[slug]).filter(Boolean)
            topicsList = topicsList.length
              ? topicsList
              : topTopics()
                  .slice(0, 9)
                  .map((topic) => ({
                    ...topic,
                    isUnread: ft[topic.slug]?.some((article) => !seen()[article.slug]),
                    key: `topic-${topic.slug}`
                  }))
            setTopicsList(topicsList)
          }
          return
        }

        // Для залогиненных с подписками
        if (loggedIn && followsTopics?.length) {
          const followedTopics = followsTopics.map((topic) => ({
            ...topic,
            isUnread: false,
            key: `topic-${topic.slug}`
          }))
          setTopicsList(followedTopics)
        }
      },
      { defer: true }
    )
  )

  return (
    <div class={styles.sidebar}>
      <nav class={styles.feedFilters}>
        <A href="/feed" classList={{ [styles.selected]: selected() === 'all' }}>
          <div class={styles.sidebarItemName}>
            <Icon name="feed-all" class={styles.icon} />
            <span class={styles.sidebarItemNameLabel}>{t('All')}</span>
          </div>
        </A>

        <A href="/feed/followed" classList={{ [styles.selected]: selected() === 'followed' }}>
          <div class={styles.sidebarItemName}>
            <Icon name="feed-my" class={styles.icon} />
            <span class={styles.sidebarItemNameLabel}>{t('My feed')}</span>
          </div>
        </A>

        <A href="/feed/coauthored" classList={{ [styles.selected]: selected() === 'coauthored' }}>
          <div class={styles.sidebarItemName}>
            <Icon name="feed-collaborate" class={styles.icon} />
            <span class={styles.sidebarItemNameLabel}>{t('Participation')}</span>
          </div>
        </A>

        <A href="/feed/discussed" classList={{ [styles.selected]: selected() === 'discussed' }}>
          <div class={styles.sidebarItemName}>
            <Icon name="feed-discussion" class={styles.icon} />
            <span class={styles.sidebarItemNameLabel}>{t('Discussions')}</span>
          </div>
        </A>
      </nav>

      <section>
        <hr />
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
