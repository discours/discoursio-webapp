import { UploadFile } from '@solid-primitives/upload'
import { Cropt } from 'cropt'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { Button } from '../Button'

import styles from './ImageCropper.module.scss'

interface CropperProps {
  uploadFile: UploadFile
  /**
   * Обработчик сохранения обрезанного изображения
   * @param file - обрезанный файл изображения
   */
  onSave: (file: File) => void
  /** Обработчик отмены обрезки */
  onDecline?: () => void
}

/**
 * Компонент для обрезки изображений с использованием библиотеки cropt
 * Поддерживает квадратную обрезку с возможностью масштабирования
 */
export const ImageCropper = (props: CropperProps) => {
  const { t } = useLocalize()
  let containerRef: HTMLDivElement | undefined
  const [croptInstance, setCroptInstance] = createSignal<Cropt | null>(null)
  const [isLoading, setIsLoading] = createSignal(false)

  onMount(async () => {
    if (!containerRef || !props.uploadFile.source) return

    try {
      // Создаем изображение для cropt
      const img = document.createElement('img')
      img.src = props.uploadFile.source
      img.style.maxWidth = '100%'
      img.style.maxHeight = '100%'
      containerRef.appendChild(img)

      // Создаем экземпляр Cropt с квадратной областью обрезки
      const cropper = new Cropt(img, {
        viewport: {
          width: 250,
          height: 250,
          borderRadius: '50%' // Круглая область обрезки для аватаров
        },
        mouseWheelZoom: 'on',
        zoomerInputClass: 'cr-slider'
      })

      // Привязываем изображение к cropt
      await cropper.bind(props.uploadFile.source)
      setCroptInstance(cropper)
    } catch (error) {
      console.error('[ImageCropper] Ошибка инициализации cropt:', error)
    }
  })

  onCleanup(() => {
    const cropper = croptInstance()
    if (cropper) {
      cropper.destroy()
      setCroptInstance(null)
    }
  })

  /**
   * Обработка сохранения обрезанного изображения
   */
  const handleSave = async () => {
    const cropper = croptInstance()
    if (!cropper) return

    try {
      setIsLoading(true)

      // Получаем обрезанное изображение как Blob
      const blob = await cropper.toBlob(null, 'image/jpeg', 0.9)

      // Создаем File из Blob с оригинальным именем
      const file = new File([blob], props.uploadFile.file.name, {
        type: 'image/jpeg',
        lastModified: Date.now()
      })

      props.onSave(file)
    } catch (error) {
      console.error('[ImageCropper] Ошибка сохранения:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div class={styles.cropperContainer}>
      <div
        ref={containerRef}
        class={styles.cropperImageContainer}
        style={{
          'min-height': '320px',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center'
        }}
      />

      <div class={styles.cropperControls}>
        <Show when={props.onDecline}>
          <Button
            variant="secondary"
            onClick={props.onDecline}
            value={t('Decline')}
            disabled={isLoading()}
          />
        </Show>

        <Button
          variant="primary"
          onClick={handleSave}
          value={isLoading() ? t('Saving...') : t('Save')}
          disabled={isLoading() || !croptInstance()}
        />
      </div>
    </div>
  )
}
