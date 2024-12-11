import { A, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { useLocalize } from '~/context/localize'
import { useSnackbar, useUI } from '~/context/ui'
import type { Shout } from '~/graphql/schema/core.gen'
import { Icon } from '../_shared/Icon'

import styles from './Draft.module.scss'

type Props = {
  shout: Shout
  onPublish: (shout: Shout) => void
  onDelete: (shout: Shout) => void
}

export const Draft = (props: Props) => {
  const { t, formatDate } = useLocalize()
  const { showConfirm } = useUI()
  const { showSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const handlePublishLinkClick = (e: MouseEvent) => {
    e.preventDefault()
    if (props.shout.main_topic?.slug) {
      props.onPublish(props.shout)
    } else {
      showSnackbar({ body: t('Please, set the main topic first') })
      navigate(`/edit/${props.shout.id}/settings`)
    }
  }

  const handleDeleteLinkClick = async (e: MouseEvent) => {
    e.preventDefault()

    const isConfirmed = await showConfirm({
      confirmBody: t('Are you sure you want to delete this draft?'),
      confirmButtonLabel: t('Delete'),
      confirmButtonVariant: 'danger',
      declineButtonVariant: 'primary'
    })
    if (isConfirmed) {
      props.onDelete(props.shout)

      await showSnackbar({ body: t('Draft successfully deleted') })
    }
  }

  return (
    <div class={styles.draft}>
      <div class={styles.created}>
        <Icon name="pencil-outline" class={styles.icon} />{' '}
        {formatDate(new Date(props.shout.created_at * 1000), { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div class={styles.titleContainer}>
        <span class={styles.title}>{props.shout.title || t('Unnamed draft')}</span> {props.shout.subtitle}
      </div>
      <div class={styles.actions}>
        <A class={styles.actionItem} href={`/edit/${props.shout?.id.toString()}`}>
          {t('Edit')}
        </A>
        <span onClick={handlePublishLinkClick} class={clsx(styles.actionItem, styles.publish)}>
          {t('Publish')}
        </span>
        <span onClick={handleDeleteLinkClick} class={clsx(styles.actionItem, styles.delete)}>
          {t('Delete')}
        </span>
      </div>
    </div>
  )
}
