import { Loading } from '../Loading'
import styles from './InlineLoader.module.scss'

type Props = {
  class?: string
}

export const InlineLoader = (_props: Props) => {
  return (
    <div class={styles.InlineLoader}>
      <div class={styles.icon}>
        <Loading size="tiny" />
      </div>
    </div>
  )
}
