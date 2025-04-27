import { useLocalize } from '~/context/localize'

import styles from './DraftPreview.module.scss'

/**
 * Рендер панели инструментов предпросмотра
 */
export const DraftPreviewToolbar = () => {
  const { t } = useLocalize()
  return (
    <div class={styles.previewToolbar}>
      {t('Preview Mode')}
      <span class={styles.previewToolbarSubtitle}>
        {t('This is how your post will look when published')}
      </span>
    </div>
  )
}
