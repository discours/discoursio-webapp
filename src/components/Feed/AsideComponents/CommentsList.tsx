import { A } from '@solidjs/router'
import { For, Show } from 'solid-js'
import { AuthorLink } from '~/components/Author/AuthorLink'
import { CommentDate } from '~/components/Comments/CommentDate'
import { AsideSection } from '~/components/Feed/AsideComponents/AsideSection'
import { useLocalize } from '~/context/localize'
import { Author, Reaction } from '~/graphql/generated/graphql'
import styles from './CommentsList.module.scss'

export interface CommentsListProps {
  comments: Reaction[]
  title?: string
  maxItems?: number
  showArticleTitle?: boolean
  collapsible?: boolean
}

export const CommentsList = (props: CommentsListProps) => {
  const { t } = useLocalize()

  const visibleComments = () => {
    const comments = props.comments || []
    return props.maxItems ? comments.slice(0, props.maxItems) : comments
  }

  return (
    <Show when={props.comments?.length > 0}>
      <AsideSection
        title={props.title || t('Recent comments')}
        icon="chat"
        collapsible={props.collapsible}
        class={styles.commentsSection}
      >
        <div class={styles.commentsList}>
          <For each={visibleComments()}>
            {(comment) => {
              const suffix = comment.id ? `?commentId=${comment.id}` : ''

              return (
                <article class={styles.commentItem} id={`comment-${comment.id}`}>
                  <div class={styles.commentBody}>
                    <A
                      href={`/${comment.shout.slug}${suffix}`}
                      class={styles.commentLink}
                      innerHTML={comment.body || ''}
                    />
                  </div>

                  <div class={styles.commentMeta}>
                    <AuthorLink author={comment.created_by as Author} size={'XS'} class={styles.commentAuthor} />
                    <CommentDate comment={comment} isShort={true} isLastInRow={true} />
                  </div>

                  <Show when={props.showArticleTitle && comment.shout.title}>
                    <div class={styles.commentArticle}>
                      <A href={`/${comment.shout.slug}`} class={styles.articleLink}>
                        {comment.shout.title}
                      </A>
                    </div>
                  </Show>
                </article>
              )
            }}
          </For>

          <Show when={props.comments.length > (props.maxItems || 0) && props.maxItems}>
            <div class={styles.viewMore}>
              <A href="/comments" class={styles.viewMoreLink}>
                {t('View all comments')} ({props.comments.length})
              </A>
            </div>
          </Show>
        </div>
      </AsideSection>
    </Show>
  )
}
