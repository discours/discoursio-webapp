// TODO: implement share form showing with modal

import type { Component } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { Icon } from '../_shared/Icon'
import { Modal } from '../_shared/Modal'

export const Share: Component = () => {
  const { t } = useLocalize()
  const { showModal, hideModal } = useUI()

  const handleShare = () => {
    showModal('share')
  }

  return (
    <>
      <button type="button" onClick={handleShare} aria-label={t('Share')}>
        <Icon name="share-outline" />
      </button>

      <Modal name="share" variant="medium" onClose={hideModal}>
        <div style={{ padding: '2rem' }}>
          <h3>{t('Share this content')}</h3>
          <p>{t('Share functionality will be implemented here')}</p>
        </div>
      </Modal>
    </>
  )
}
