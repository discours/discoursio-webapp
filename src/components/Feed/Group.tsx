import { For, Show } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import type { Shout } from '~/graphql/generated/graphql'

import { ArticleCard } from './ArticleCard'
import './Group.scss'

interface GroupProps {
  articles: Shout[]
  header?: JSX.Element
}

export default (props: GroupProps) => {
  return (
    <div class="floor floor--group">
      <Show when={props.articles.length > 4}>
        <div class="wide-container">
          <div class="row">
            <div class="group__header col-24">{props.header}</div>

            <div class="col-lg-12">
              <ArticleCard
                article={props.articles[0]}
                settings={{
                  nosubtitle: false,
                  noicon: true,
                  isBigTitle: true,
                  nodate: true
                }}
                desktopCoverSize="M"
              />
            </div>

            <div class="col-lg-12">
              <div class="row">
                <Show when={props.articles.length < 4}>
                  <For each={props.articles.slice(1, props.articles.length)}>
                    {(a) => (
                      <div class="row">
                        <div class="col-md-16">
                          <ArticleCard
                            article={a}
                            settings={{ nosubtitle: false, noicon: true, isBigTitle: true, nodate: true }}
                            desktopCoverSize="XS"
                          />
                        </div>
                      </div>
                    )}
                  </For>
                </Show>
                <Show when={props.articles.length >= 4}>
                  <div class="col-md-12">
                    <For each={props.articles.slice(1, 3)}>
                      {(a) => (
                        <ArticleCard
                          article={a}
                          settings={{
                            noicon: true,
                            noimage: true,
                            isBigTitle: true,
                            isCompact: true,
                            nodate: true
                          }}
                          desktopCoverSize="XS"
                        />
                      )}
                    </For>
                  </div>
                  <div class="col-md-12">
                    <For each={props.articles.slice(3, 5)}>
                      {(a) => (
                        <ArticleCard
                          article={a}
                          settings={{
                            noicon: true,
                            noimage: true,
                            isBigTitle: true,
                            isCompact: true,
                            nodate: true
                          }}
                          desktopCoverSize="XS"
                        />
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
