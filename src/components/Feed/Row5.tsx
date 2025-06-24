import { Show } from 'solid-js'
import type { Shout } from '~/graphql/schema/core.gen'
import { ArticleCard } from './ArticleCard'
import { ArticleCardSkeleton } from './ArticleCardSkeleton'

export const Row5 = (props: { articles: Shout[]; nodate?: boolean }) => {
  // Проверяем что у нас есть хотя бы 5 статей с валидными данными
  const hasArticles = () => {
    const articles = props.articles || []
    return articles.length >= 5 && articles.every(article => article?.id)
  }

  return (
    <div class="floor floor--1">
      <div class="wide-container">
        <div class="row">
          <div class="col-md-6">
            <Show when={hasArticles()} fallback={<ArticleCardSkeleton size="small" />}>
              <ArticleCard
                article={props.articles[0]}
                settings={{ nodate: props.nodate }}
                desktopCoverSize="XS"
              />
            </Show>
            <Show when={hasArticles()} fallback={<ArticleCardSkeleton size="noimage" />}>
              <ArticleCard
                article={props.articles[1]}
                settings={{ noimage: true, withBorder: true, nodate: props.nodate }}
                desktopCoverSize="XS"
              />
            </Show>
          </div>
          <div class="col-md-12">
            <Show when={hasArticles()} fallback={<ArticleCardSkeleton size="large" />}>
              <ArticleCard
                article={props.articles[2]}
                settings={{ isBigTitle: true, nodate: props.nodate }}
                desktopCoverSize="M"
              />
            </Show>
          </div>
          <div class="col-md-6">
            <Show when={hasArticles()} fallback={<ArticleCardSkeleton size="small" />}>
              <ArticleCard
                article={props.articles[3]}
                settings={{ nodate: props.nodate }}
                desktopCoverSize="XS"
              />
            </Show>
            <Show when={hasArticles()} fallback={<ArticleCardSkeleton size="noimage" />}>
              <ArticleCard
                article={props.articles[4]}
                settings={{ noimage: true, withBorder: true, nodate: props.nodate }}
                desktopCoverSize="XS"
              />
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
}
