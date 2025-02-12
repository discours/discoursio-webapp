import { clsx } from 'clsx'
import { Loading } from '~/components/_shared/Loading'
import { useLocalize } from '~/context/localize'
import styles from './AutoSaveNotice.module.scss'

type Props = {
  active: boolean
}

export const AutoSaveNotice = (props: Props) => {
  const { t } = useLocalize()
  return (
    <div class={clsx(styles.AutoSaveNotice, { [styles.active]: props.active })}>
      <div class={styles.icon}>
        <Loading size="tiny" />
      </div>
      <div>{t('Saving...')}</div>
    </div>
  )
}
