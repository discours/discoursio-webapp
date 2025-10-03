import { createSignal } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { Button } from '../Button'
import { VideoPlayer } from '../VideoPlayer'

import styles from './VideoPreview.module.scss'

interface VideoPreviewProps {
  videoUrl: string
  onSave: (url: string) => void
  onDecline?: () => void
}

export const VideoPreview = (props: VideoPreviewProps) => {
  const { t } = useLocalize()
  const [isLoading, setIsLoading] = createSignal(false)

  const handleSave = async () => {
    setIsLoading(true)
    try {
      props.onSave(props.videoUrl)
    } catch (error) {
      console.error('Ошибка при сохранении видео:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDecline = () => {
    props.onDecline?.()
  }

  return (
    <div class={styles.VideoPreview}>
      <div class={styles.previewContainer}>
        <VideoPlayer videoUrl={props.videoUrl} title="Video Preview" articleView={true} />
      </div>

      <div class={styles.actions}>
        <Button size="L" variant="secondary" onClick={handleDecline} disabled={isLoading()} value={t('Cancel')} />

        <Button size="L" variant="primary" onClick={handleSave} loading={isLoading()} value={t('Insert video')} />
      </div>
    </div>
  )
}
