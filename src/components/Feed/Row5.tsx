import { Show } from 'solid-js'
import type { Shout } from '~/graphql/generated/graphql'
import { ArticleCard } from './ArticleCard'
import { ArticleCardSkeleton } from './ArticleCardSkeleton'

export const Row5 = (props: { articles: Shout[]; nodate?: boolean }) => {
  const hasArticle = (index: number) => {
    const articles = props.articles || []
    return articles[index]?.id
  }

  return (
    <div class="floor floor--1">
      <div class="wide-container">
        <div class="row">
          <div class="col-md-6">
            <Show when={hasArticle(0)} fallback={<ArticleCardSkeleton size="small" />}>
              <ArticleCard article={props.articles[0]} settings={{ nodate: props.nodate }} desktopCoverSize="XS" />
            </Show>
            <Show when={hasArticle(1)} fallback={<ArticleCardSkeleton size="noimage" />}>
              <ArticleCard
                article={props.articles[1]}
                settings={{ noimage: true, withBorder: true, nodate: props.nodate }}
                desktopCoverSize="XS"
              />
            </Show>
          </div>
          <div class="col-md-12">
            <Show when={hasArticle(2)} fallback={<ArticleCardSkeleton size="medium" />}>
              <ArticleCard
                article={props.articles[2]}
                settings={{ isBigTitle: true, nodate: props.nodate }}
                desktopCoverSize="M"
              />
            </Show>
          </div>
          <div class="col-md-6">
            <Show when={hasArticle(3)} fallback={<ArticleCardSkeleton size="small" />}>
              <ArticleCard article={props.articles[3]} settings={{ nodate: props.nodate }} desktopCoverSize="XS" />
            </Show>
            <Show when={hasArticle(4)} fallback={<ArticleCardSkeleton size="noimage" />}>
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
