import { For, Show } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import type { Shout } from '~/graphql/generated/graphql'

import { ArticleCard } from './ArticleCard'

export const Row3 = (props: {
  articles: Shout[]
  header?: JSX.Element
  nodate?: boolean
  noAuthorLink?: boolean
  noauthor?: boolean
}) => {
  return (
    <Show when={props.articles && props.articles.length > 0}>
      <div class="floor">
        <div class="wide-container">
          <div class="row">
            <Show when={props.header}>
              <div class="floor-header">{props.header}</div>
            </Show>
            <For each={props.articles}>
              {(a) => (
                <div class="col-md-8">
                  <ArticleCard
                    article={a}
                    settings={{
                      nodate: props.nodate,
                      noAuthorLink: props.noAuthorLink,
                      noauthor: props.noauthor
                    }}
                    desktopCoverSize="S"
                  />
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  )
}
