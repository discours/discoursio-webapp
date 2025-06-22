import 'cropperjs/dist/cropper.css'
import { UploadFile } from '@solid-primitives/upload'
import Cropper from 'cropperjs'
import { createSignal, onMount, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { Button } from '../Button'

import './cropper.css'
import styles from './ImageCropper.module.scss'

interface CropperProps {
  uploadFile: UploadFile
  // biome-ignore lint/suspicious/noExplicitAny: save file
  onSave: (arg0: any) => void
  onDecline?: () => void
}

export const ImageCropper = (props: CropperProps) => {
  const { t } = useLocalize()
  let imageTagRef: HTMLImageElement | null
  const [cropper, setCropper] = createSignal<Cropper>()

  onMount(() => {
    setCropper((_) => {
      if (!imageTagRef) return
      new Cropper(imageTagRef, {
        viewMode: 1,
        aspectRatio: 1,
        guides: false,
        background: false,
        rotatable: false,
        autoCropArea: 1,
        modal: true
      })
      return undefined
    })
  })

  return (
    <div>
      <div class={styles.cropperContainer}>
        <img ref={(el) => (imageTagRef = el)} src={props.uploadFile.source} alt="image crop panel" />
      </div>

      <div class={styles.cropperControls}>
        <Show when={props.onDecline}>
          <Button variant="secondary" onClick={props.onDecline} value={t('Decline')} />
        </Show>

        <Button
          variant="primary"
          onClick={() => {
            cropper()
              ?.getCroppedCanvas()
              .toBlob(((blob: Blob) => {
                const formData = new FormData()
                formData.append('media', blob, props.uploadFile.file.name)

                props.onSave({
                  ...props.uploadFile,
                  file: formData.get('media')
                })
              }) as BlobCallback)
          }}
          value={t('Save')}
        />
      </div>
    </div>
  )
}
