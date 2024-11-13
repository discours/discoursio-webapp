import { A, useParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import { useFeed } from '~/context/feed'
import { useFollowing } from '~/context/following'
import { useLocalize } from '~/context/localize'
import { Userpic } from '../../Author/Userpic'

import styles from './Sidebar.module.scss'

export const Sidebar = () => {
  const { t } = useLocalize()
  const { follows } = useFollowing()
  const { feedByTopic, feedByAuthor, seen } = useFeed()
  const [selected, setSelected] = createSignal('all')
  const params = useParams()
  createEffect(() => {
    setSelected(params.mode || 'all')
  })

  // Создаем стабильные сигналы для SSR
  const [isAuthorsVisible, setAuthorsVisible] = createSignal<boolean>(false)
  const [isTopicsVisible, setTopicsVisible] = createSignal<boolean>(false)

  // Мемоизируем списки с проверкой на SSR
  const authorsList = createMemo(() => {
    const authors = follows.authors
    if (!authors?.length) return []

    return authors
      .filter(Boolean)
      .map(author => ({
        ...author,
        isUnread: feedByAuthor()[author.slug]?.every(
          (article) => Boolean(seen()[article.slug])
        ),
        key: `author-${author.slug}`
      }))
  })

  const topicsList = createMemo(() => {
    const topics = follows.topics
    if (!topics?.length) return []

    return topics
      .filter(Boolean)
      .map(topic => ({
        ...topic,
        isUnread: feedByTopic()[topic.slug]?.every(
          (article) => Boolean(seen()[article.slug])
        ),
        key: `topic-${topic.slug}`
      }))
  })

  // Компонент списка авторов
  const AuthorsList = () => {
    const authors = authorsList()
    if (!authors.length) return null

    return (
      <ul class={styles.subscriptions}>
        <For each={authors}>
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
                  <span class={styles.sidebarItemNameLabel}>
                    {author.name}
                  </span>
                </div>
              </a>
            </li>
          )}
        </For>
      </ul>
    )
  }

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
        <button
          type="button"
          class={clsx(styles.sectionHeader, {
            [styles.opened]: isAuthorsVisible()
          })}
          onClick={() => setAuthorsVisible(prev => !prev)}
        >
          <span>{t('Authors')}</span>
          <Icon name="toggle-arrow" class={styles.icon} />
        </button>
        <Show when={isAuthorsVisible()}>
          <AuthorsList />
        </Show>
      </section>

      <section>
        <button
          type="button"
          class={styles.sectionHeader}
          onClick={() => setTopicsVisible(prev => !prev)}
        >
          <span>{t('Topics')}</span>
          <Icon name="toggle-arrow" class={styles.icon} />
        </button>
        <Show when={isTopicsVisible()}>
          <ul class={styles.subscriptions}>
            <For each={topicsList()}>
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
        </Show>
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
