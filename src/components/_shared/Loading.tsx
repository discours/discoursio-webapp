import { clsx } from 'clsx'
import { Icon } from './Icon'

import styles from './Loading.module.scss'

type Props = {
  size?: 'small' | 'tiny'
}
export const Loading = (props: Props) => {
  return (
    <div
      class={clsx(styles.container, {
        [styles.small]: props.size === 'small',
        [styles.tiny]: props.size === 'tiny'
      })}
    >
      <Icon name="arrows-rotate" class={styles.icon} />
    </div>
  )
}
