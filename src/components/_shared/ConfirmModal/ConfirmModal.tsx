import { Button } from '~/components/_shared/Button'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'

import styles from './ConfirmModal.module.scss'

export const ConfirmModal = () => {
  const { t } = useLocalize()
  const { confirmMessage, resolveConfirm } = useUI()

  return (
    <div class={styles.confirmModal}>
      <h2 class={styles.confirmModalTitle} id="confirm-modal-title">
        {confirmMessage().confirmBody ?? t('Are you sure you want to to proceed the action?')}
      </h2>

      <div class={styles.confirmModalActions}>
        <Button
          onClick={() => resolveConfirm(false)}
          value={confirmMessage().declineButtonLabel ?? t('Decline')}
          size="L"
          variant={confirmMessage().declineButtonVariant ?? 'secondary'}
          class={styles.confirmAction}
        />
        <Button
          onClick={() => resolveConfirm(true)}
          value={confirmMessage().confirmButtonLabel ?? t('Confirm')}
          size="L"
          variant={confirmMessage().confirmButtonVariant ?? 'primary'}
          class={styles.confirmAction}
        />
      </div>
    </div>
  )
}
