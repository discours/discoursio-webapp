import type { Reaction } from '~/graphql/schema/core.gen'

import { clsx } from 'clsx'

import { useLocalize } from '~/context/localize'

import styles from './CommentDate.module.scss'

type Props = {
  comment: Reaction
  isShort?: boolean
  isLastInRow?: boolean
  showOnHover?: boolean
}

export const CommentDate = (props: Props) => {
  const { formatDate } = useLocalize()

  const formattedDate = (date: number) => {
    const formatDateOptions: Intl.DateTimeFormatOptions = props.isShort
      ? { month: 'long', day: 'numeric', year: 'numeric' }
      : { hour: 'numeric', minute: 'numeric' }

    return formatDate(new Date(date), formatDateOptions)
  }

  return (
    <div
      class={clsx(styles.commentDates, {
        [styles.commentDatesLastInRow]: props.isLastInRow,
        [styles.showOnHover]: props.showOnHover
      })}
    >
      <time class={styles.date}>{formattedDate(props.comment.created_at * 1000)}</time>
    </div>
  )
}
