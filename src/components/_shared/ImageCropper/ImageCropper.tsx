import { UploadFile } from '@solid-primitives/upload'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { Button } from '../Button'

import styles from './ImageCropper.module.scss'

interface CropperProps {
  uploadFile: UploadFile
  // biome-ignore lint/suspicious/noExplicitAny: save file
  onSave: (arg0: any) => void
  onDecline?: () => void
}

export const ImageCropper = (props: CropperProps) => {
  const { t } = useLocalize()
  let canvasRef: HTMLCanvasElement | undefined
  let imageRef: HTMLImageElement | undefined
  let containerRef: HTMLDivElement | undefined

  const [isLoading, setIsLoading] = createSignal(false)
  const [cropData, setCropData] = createSignal({
    x: 0,
    y: 0,
    width: 300,
    height: 300
  })
  const [isDragging, setIsDragging] = createSignal(false)
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 })
  const [imageLoaded, setImageLoaded] = createSignal(false)
  const [imageSize, setImageSize] = createSignal({ width: 0, height: 0 })

  const drawImage = () => {
    if (!canvasRef || !imageRef || !imageLoaded()) return

    const ctx = canvasRef.getContext('2d')
    if (!ctx) return

    const canvas = canvasRef
    const img = imageRef

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Рисуем изображение
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // Рисуем затемнение
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Очищаем область обрезки
    const crop = cropData()
    ctx.clearRect(crop.x, crop.y, crop.width, crop.height)

    // Рисуем изображение в области обрезки
    ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, crop.x, crop.y, crop.width, crop.height)

    // Рисуем рамку
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.strokeRect(crop.x, crop.y, crop.width, crop.height)
  }

  const handleMouseDown = (e: MouseEvent) => {
    const rect = canvasRef?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const crop = cropData()

    // Проверяем, нажали ли в области обрезки
    if (x >= crop.x && x <= crop.x + crop.width && y >= crop.y && y <= crop.y + crop.height) {
      setIsDragging(true)
      setDragStart({ x: x - crop.x, y: y - crop.y })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging() || !canvasRef) return

    const rect = canvasRef.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const drag = dragStart()

    const newX = Math.max(0, Math.min(canvasRef.width - cropData().width, x - drag.x))
    const newY = Math.max(0, Math.min(canvasRef.height - cropData().height, y - drag.y))

    setCropData({ ...cropData(), x: newX, y: newY })
    drawImage()
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const cropImage = () => {
    if (!canvasRef || !imageRef || !imageLoaded()) return null

    const crop = cropData()
    const scale = imageSize().width / canvasRef.width

    // Создаем новый canvas для обрезанного изображения
    const cropCanvas = document.createElement('canvas')
    const cropCtx = cropCanvas.getContext('2d')
    if (!cropCtx) return null

    cropCanvas.width = crop.width * scale
    cropCanvas.height = crop.height * scale

    // Рисуем обрезанное изображение
    cropCtx.drawImage(
      imageRef,
      crop.x * scale,
      crop.y * scale,
      crop.width * scale,
      crop.height * scale,
      0,
      0,
      cropCanvas.width,
      cropCanvas.height
    )

    return cropCanvas
  }

  const handleSave = async () => {
    setIsLoading(true)

    try {
      const croppedCanvas = cropImage()
      if (!croppedCanvas) {
        throw new Error('Не удалось создать обрезанное изображение')
      }

      // Конвертируем canvas в blob
      croppedCanvas.toBlob((blob) => {
        if (blob) {
          props.onSave(blob)
        }
      }, 'image/png')
    } catch (error) {
      console.error('Ошибка при сохранении:', error)
    } finally {
      setIsLoading(false)
    }
  }

  onMount(() => {
    if (!containerRef) return

    // Создаем изображение
    const img = new Image()
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
      setImageLoaded(true)

      // Настраиваем canvas
      if (canvasRef) {
        canvasRef.width = 400
        canvasRef.height = 400

        // Центрируем область обрезки
        const size = Math.min(canvasRef.width, canvasRef.height) * 0.6
        setCropData({
          x: (canvasRef.width - size) / 2,
          y: (canvasRef.height - size) / 2,
          width: size,
          height: size
        })

        drawImage()
      }
    }

    img.src = URL.createObjectURL(props.uploadFile.file)
    imageRef = img

    // Добавляем обработчики событий
    const canvas = canvasRef
    if (canvas) {
      canvas.addEventListener('mousedown', handleMouseDown)
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
  })

  onCleanup(() => {
    if (canvasRef) {
      canvasRef.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    if (imageRef) {
      URL.revokeObjectURL(imageRef.src)
    }
  })

  return (
    <div class={styles.cropperContainer}>
      <div class={styles.cropperCanvas}>
        <canvas
          ref={canvasRef}
          style={{
            border: '1px solid #ccc',
            cursor: isDragging() ? 'grabbing' : 'grab',
            'max-width': '100%',
            'max-height': '400px'
          }}
        />
        <canvas ref={canvasRef} class={isDragging() ? 'dragging' : ''} />
      </div>

      <div class={styles.cropperControls}>
        <Show when={props.onDecline}>
          <Button variant="secondary" onClick={props.onDecline} value={t('Decline')} />
        </Show>

        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isLoading() || !imageLoaded()}
          value={isLoading() ? t('Processing...') : t('Save')}
        />
      </div>
    </div>
  )
}
