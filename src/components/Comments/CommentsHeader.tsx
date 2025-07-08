import { clsx } from 'clsx'
import { Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { ReactionSort } from '~/graphql/generated/graphql'
import { Button } from '../_shared/Button'
import { Icon } from '../_shared/Icon'

import styles from './CommentsHeader.module.scss'

/**
 * Свойства компонента заголовка комментариев
 * @typedef {Object} CommentsHeaderProps
 * @property {boolean} onlyNew - Флаг отображения только новых комментариев
 * @property {number} comments - Количество всех комментариев
 * @property {number} newComments - Количество новых комментариев
 * @property {ReactionSort} order - Текущая сортировка комментариев
 * @property {Function} setOrder - Функция для установки сортировки
 * @property {Function} toggleNewOnly - Функция для переключения режима отображения новых комментариев
 */
type CommentsHeaderProps = {
  onlyNew: boolean
  comments: number
  newComments: number
  order: ReactionSort
  setOrder: (order: ReactionSort) => void
  toggleNewOnly: () => void
}

/**
 * Компонент заголовка комментариев
 * Отображает заголовок с количеством комментариев и переключатели режима отображения
 */
export const CommentsHeader = (props: CommentsHeaderProps) => {
  const { t } = useLocalize()

  return (
    <div class={styles.commentsHeaderWrapper}>
      <Show when={props.comments > 0}>
        <h2 class={styles.commentsHeader}>
          <Icon name="comments-outline" class={styles.commentsIcon} />
          {t('Comments')}
          <span class={styles.commentsCount}>{props.comments.toString() || ''}</span>
          <Show when={props.newComments > 0}>
            <span onClick={props.toggleNewOnly} class={styles.newReactions}>
              {` +${props.newComments}`} {props.onlyNew ? `(${t('New only').toLowerCase()})` : ''}
            </span>
          </Show>
        </h2>
      </Show>
      <Show when={props.comments > 0}>
        <ul class={clsx(styles.commentsFeedSwitcher, 'view-switcher')}>
          <li
            classList={{
              'view-switcher__item--selected': !props.onlyNew && props.order === ReactionSort.Newest
            }}
          >
            <Button
              variant="light"
              value={t('By time')}
              onClick={() => {
                props.setOrder(ReactionSort.Newest)
                props.onlyNew && props.toggleNewOnly()
              }}
            />
          </li>
          <li
            classList={{
              'view-switcher__item--selected': !props.onlyNew && props.order === ReactionSort.Like
            }}
          >
            <Button
              variant="light"
              value={t('By rating')}
              onClick={() => {
                props.setOrder(ReactionSort.Like)
                props.onlyNew && props.toggleNewOnly()
              }}
            />
          </li>
          <Show when={props.newComments > 0}>
            <li classList={{ 'view-switcher__item--selected': props.onlyNew }}>
              <Button variant="light" value={t('New only')} onClick={props.toggleNewOnly} />
            </li>
          </Show>
        </ul>
      </Show>
    </div>
  )
}
