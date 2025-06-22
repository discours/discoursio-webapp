import { createEffect, createSignal, For, Show } from 'solid-js'
import type { Shout } from '~/graphql/schema/core.gen'

import { ArticleCard } from './ArticleCard'

const columnSizes = ['col-md-12', 'col-md-8', 'col-md-16']

export const Row2 = (props: {
  articles: Shout[]
  isEqual?: boolean
  nodate?: boolean
  noAuthorLink?: boolean
  noauthor?: boolean
}) => {
  const [columnIndex, setColumnIndex] = createSignal(0)

  // Update column index on component mount
  createEffect(() => setColumnIndex(Math.floor(Math.random() * columnSizes.length)))

  return (
    <Show when={props.articles && props.articles.length > 0}>
      <div class="floor">
        <div class="wide-container">
          <div class="row">
            <For each={props.articles}>
              {(article, _idx) => {
                const className = columnSizes[props.isEqual ? 0 : columnIndex() % columnSizes.length]
                const big = className === 'col-md-12' ? 'M' : 'L'
                const desktopCoverSize = className === 'col-md-8' ? 'S' : big
                return (
                  <div class={className}>
                    <ArticleCard
                      article={article}
                      settings={{
                        isWithCover: props.isEqual || className === 'col-md-16',
                        nodate: props.isEqual || props.nodate,
                        noAuthorLink: props.noAuthorLink,
                        noauthor: props.noauthor
                      }}
                      desktopCoverSize={desktopCoverSize}
                    />
                  </div>
                )
              }}
            </For>
          </div>
        </div>
      </div>
    </Show>
  )
}
