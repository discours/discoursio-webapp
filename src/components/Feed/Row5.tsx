import { Show } from 'solid-js'
import type { Shout } from '~/graphql/schema/core.gen'
import { ArticleCard } from './ArticleCard'

export const Row5 = (props: { articles: Shout[]; nodate?: boolean }) => {
  const hasArticles = props.articles?.length >= 5

  return (
    <Show when={hasArticles}>
      <div class="floor floor--1">
        <div class="wide-container">
          <div class="row">
            <div class="col-md-6">
              <ArticleCard
                article={props.articles[0]}
                settings={{ nodate: props.nodate }}
                desktopCoverSize="XS"
              />
              <ArticleCard
                article={props.articles[1]}
                settings={{ noimage: true, withBorder: true, nodate: props.nodate }}
                desktopCoverSize="XS"
              />
            </div>
            <div class="col-md-12">
              <ArticleCard
                article={props.articles[2]}
                settings={{ isBigTitle: true, nodate: props.nodate }}
                desktopCoverSize="M"
              />
            </div>
            <div class="col-md-6">
              <ArticleCard
                article={props.articles[3]}
                settings={{ nodate: props.nodate }}
                desktopCoverSize="XS"
              />
              <ArticleCard
                article={props.articles[4]}
                settings={{ noimage: true, withBorder: true, nodate: props.nodate }}
                desktopCoverSize="XS"
              />
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
