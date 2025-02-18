import { clsx } from 'clsx'
import { Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { Reaction, ReactionSort } from '~/graphql/schema/core.gen'
import { Button } from '../_shared/Button'

import styles from '../Article/Article.module.scss'

type Props = {
  onlyNew: boolean
  comments: Reaction[]
  newComments: Reaction[]
  order: ReactionSort
  setOrder: (order: ReactionSort) => void
  toggleNewOnly: () => void
}

export const CommentsHeader = (props: Props) => {
  const { t } = useLocalize()

  return (
    <div class={styles.commentsHeaderWrapper}>
      <Show when={(props.comments || []).length > 0}>
      <h2 class={styles.commentsHeader}>
        {t('Comments')} {props.comments.length.toString() || ''}
        <Show when={props.newComments.length > 0}>
          <span class={styles.newReactions}>{` +${props.newComments.length}`}</span>
        </Show>
      </h2>
      </Show>
      <Show when={props.comments.length > 0}>
        <ul class={clsx(styles.commentsFeedSwitcher, 'view-switcher')}>
          <Show when={props.newComments.length > 0}>
            <li classList={{ 'view-switcher__item--selected': props.onlyNew }}>
              <Button variant="light" value={t('New only')} onClick={props.toggleNewOnly} />
            </li>
          </Show>
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
