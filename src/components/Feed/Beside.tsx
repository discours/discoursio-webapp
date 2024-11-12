// TODO: additional entities list column + article

import type { Author, Shout, Topic } from '~/graphql/schema/core.gen'

import { clsx } from 'clsx'
import { For, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { AuthorBadge } from '../Author/AuthorBadge'
import { TopicCard } from '../Topic/Card'
import { Icon } from '../_shared/Icon'

import { ArticleCard } from './ArticleCard'

import styles from './Beside.module.scss'

type Props = {
  title?: string
  values: (Shout | Topic | Author)[]
  beside: Shout
  wrapper: 'topic' | 'author' | 'article' | 'top-article'
  isTopicCompact?: boolean
  isTopicInRow?: boolean
  topicShortDescription?: boolean
  topicsBySlug?: { [slug: string]: Topic }
  iconButton?: boolean
  nodate?: boolean
}

export const Beside = (props: Props) => {
  const { t } = useLocalize()

  return (
    <Show when={!!props.beside?.slug && props.values?.length > 0}>
      <div class="floor floor--9">
        <div class="wide-container">
          <div class="row justify-content-between">
            <Show when={!!props.values}>
              <div
                class={clsx(
                  'col-lg-8',
                  styles[
                    `besideRatingColumn${props.wrapper?.charAt(0)?.toUpperCase() + props.wrapper.slice(1)}` as keyof typeof styles
                  ]
                )}
              >
                <Show when={!!props.title}>
                  <div class={styles.besideColumnTitle}>
                    <h4>{props.title}</h4>

                    <Show when={props.wrapper === 'author'}>
                      <a href="/author">
                        {t('All authors')}
                        <Icon name="arrow-right" class={styles.icon} />
                      </a>
                    </Show>

                    <Show when={props.wrapper === 'topic'}>
                      <a href="/topics">
                        {t('All topics')}
                        <Icon name="arrow-right" class={styles.icon} />
                      </a>
                    </Show>
                  </div>
                </Show>
                <ul
                  class={clsx(styles.besideColumn, {
                    [styles.besideColumnTopViewed]: props.wrapper === 'top-article'
                  })}
                >
                  <For each={[...props.values]}>
                    {(value: Partial<Shout | Author | Topic>) => (
                      <li classList={{ [styles.top]: props.wrapper.startsWith('top-') }}>
                        <Show when={props.wrapper === 'topic'}>
                          <TopicCard
                            topic={value as Topic}
                            compact={props.isTopicCompact}
                            shortDescription={props.topicShortDescription}
                            isTopicInRow={props.isTopicInRow}
                            iconButton={props.iconButton}
                            showPublications={true}
                            isCardMode={true}
                            isNarrow={true}
                          />
                        </Show>
                        <Show when={props.wrapper === 'author'}>
                          <AuthorBadge author={value as Author} />
                        </Show>
                        <Show when={props.wrapper === 'article' && value?.slug}>
                          <ArticleCard
                            article={value as Shout}
                            settings={{ noimage: true, nodate: props.nodate }}
                            desktopCoverSize="XS"
                          />
                        </Show>
                        <Show when={props.wrapper === 'top-article' && value?.slug}>
                          <ArticleCard
                            article={value as Shout}
                            settings={{ noimage: true, noauthor: true, nodate: true, isShort: true }}
                            desktopCoverSize="XS"
                          />
                        </Show>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </Show>
            <div class={clsx('col-lg-16', styles.shoutCardContainer)}>
              <ArticleCard
                article={props.beside}
                settings={{ isBigTitle: true, isBeside: true, nodate: props.nodate }}
                desktopCoverSize="L"
              />
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
