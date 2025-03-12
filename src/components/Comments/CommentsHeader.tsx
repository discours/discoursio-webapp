import { clsx } from 'clsx'
import { Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { Reaction, ReactionSort } from '~/graphql/schema/core.gen'
import { Button } from '../_shared/Button'
import { Icon } from '../_shared/Icon'

import styles from './CommentsHeader.module.scss'

type CommentsHeaderProps = {
  onlyNew: boolean
  comments: Reaction[]
  newComments: Reaction[]
  order: ReactionSort
  setOrder: (order: ReactionSort) => void
  toggleNewOnly: () => void
}

export const CommentsHeader = (props: CommentsHeaderProps) => {
  const { t } = useLocalize()

  return (
    <div class={styles.commentsHeaderWrapper}>
      <Show when={(props.comments || []).length > 0}>
        <h2 class={styles.commentsHeader}>
          <Icon name="comments-outline" class={styles.commentsIcon} />
          {t('Comments')}
          <span class={styles.commentsCount}>{props.comments.length.toString() || ''}</span>
          <Show when={props.newComments.length > 0}>
            <span onClick={props.toggleNewOnly} class={styles.newReactions}>
              {` +${props.newComments.length}`} {props.onlyNew ? `(${t('New only').toLowerCase()})` : ''}
            </span>
          </Show>
        </h2>
      </Show>
      <Show when={props.comments.length > 0}>
        <ul class={clsx(styles.commentsFeedSwitcher, 'view-switcher')}>
          <li classList={{ 'view-switcher__item--selected': props.order === ReactionSort.Newest }}>
            <Button
              variant="light"
              value={t('By time')}
              onClick={() => {
                props.setOrder(ReactionSort.Newest)
              }}
            />
          </li>
          <li classList={{ 'view-switcher__item--selected': props.order === ReactionSort.Like }}>
            <Button
              variant="light"
              value={t('By rating')}
              onClick={() => {
                props.setOrder(ReactionSort.Like)
              }}
            />
          </li>
        </ul>
      </Show>
    </div>
  )
}
