import { clsx } from 'clsx'
import { createMemo } from 'solid-js'
import type { Author } from '~/graphql/schema/core.gen'

import styles from './AuthorRatingControl.module.scss'

interface AuthorShoutsRating {
  author: Author
  class?: string
}

export const AuthorShoutsRating = (props: AuthorShoutsRating) => {
  const isUpvoted = createMemo(() => (props.author?.stat?.rating_shouts || 0) > 0)
  return (
    <div
      class={clsx(styles.rating, props.class, {
        [styles.isUpvoted]: isUpvoted(),
        [styles.isDownvoted]: !isUpvoted()
      })}
    >
      <span class={styles.ratingValue}>{props.author?.stat?.rating_shouts}</span>
    </div>
  )
}
