import { UploadFile } from '@solid-primitives/upload'
import { clsx } from 'clsx'
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
    width: 200,
    height: 200
  })
  const [isDragging, setIsDragging] = createSignal(false)
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 })
  const [imageLoaded, setImageLoaded] = createSignal(false)
  const [scale, setScale] = createSignal(1)

  const drawImage = () => {
    if (!canvasRef || !imageRef || !imageLoaded()) return

    const ctx = canvasRef.getContext('2d')
    if (!ctx) return

    const canvas = canvasRef
    const img = imageRef
    const currentScale = scale()

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Вычисляем размеры для отображения изображения (масштабированного)
    const displayWidth = img.naturalWidth * currentScale
    const displayHeight = img.naturalHeight * currentScale

    // Центрируем изображение на canvas
    const offsetX = (canvas.width - displayWidth) / 2
    const offsetY = (canvas.height - displayHeight) / 2

    // Рисуем изображение с масштабом
    ctx.drawImage(img, offsetX, offsetY, displayWidth, displayHeight)

    // Рисуем затемнение поверх всего
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Очищаем область обрезки (делаем ее прозрачной)
    const crop = cropData()
    ctx.clearRect(crop.x, crop.y, crop.width, crop.height)

    // Перерисовываем изображение в области обрезки
    ctx.drawImage(img, offsetX, offsetY, displayWidth, displayHeight)

    // Рисуем рамку области обрезки
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.strokeRect(crop.x, crop.y, crop.width, crop.height)

    // Добавляем углы для удобства
    const cornerSize = 10
    ctx.fillStyle = '#fff'
    // Левый верхний
    ctx.fillRect(crop.x - 1, crop.y - 1, cornerSize, 2)
    ctx.fillRect(crop.x - 1, crop.y - 1, 2, cornerSize)
    // Правый верхний
    ctx.fillRect(crop.x + crop.width - cornerSize + 1, crop.y - 1, cornerSize, 2)
    ctx.fillRect(crop.x + crop.width - 1, crop.y - 1, 2, cornerSize)
    // Левый нижний
    ctx.fillRect(crop.x - 1, crop.y + crop.height - 1, cornerSize, 2)
    ctx.fillRect(crop.x - 1, crop.y + crop.height - cornerSize + 1, 2, cornerSize)
    // Правый нижний
    ctx.fillRect(crop.x + crop.width - cornerSize + 1, crop.y + crop.height - 1, cornerSize, 2)
    ctx.fillRect(crop.x + crop.width - 1, crop.y + crop.height - cornerSize + 1, 2, cornerSize)
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
    const currentScale = scale()
    const img = imageRef

    // Вычисляем размеры отображения изображения
    const displayWidth = img.naturalWidth * currentScale
    const displayHeight = img.naturalHeight * currentScale

    // Вычисляем смещение изображения на canvas
    const offsetX = (canvasRef.width - displayWidth) / 2
    const offsetY = (canvasRef.height - displayHeight) / 2

    // Вычисляем координаты обрезки относительно оригинального изображения
    const sourceX = (crop.x - offsetX) / currentScale
    const sourceY = (crop.y - offsetY) / currentScale
    const sourceWidth = crop.width / currentScale
    const sourceHeight = crop.height / currentScale

    // Проверяем границы
    const clampedSourceX = Math.max(0, Math.min(img.naturalWidth - sourceWidth, sourceX))
    const clampedSourceY = Math.max(0, Math.min(img.naturalHeight - sourceHeight, sourceY))
    const clampedSourceWidth = Math.min(sourceWidth, img.naturalWidth - clampedSourceX)
    const clampedSourceHeight = Math.min(sourceHeight, img.naturalHeight - clampedSourceY)

    // Создаем новый canvas для обрезанного изображения
    const cropCanvas = document.createElement('canvas')
    const cropCtx = cropCanvas.getContext('2d')
    if (!cropCtx) return null

    // Размер выходного изображения
    cropCanvas.width = 300 // Фиксированный размер вывода
    cropCanvas.height = 300

    // Рисуем обрезанное изображение
    cropCtx.drawImage(
      img,
      clampedSourceX,
      clampedSourceY,
      clampedSourceWidth,
      clampedSourceHeight,
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

      // Конвертируем canvas в blob, затем в File
      croppedCanvas.toBlob((blob) => {
        if (blob) {
          // Создаем File объект из blob
          const file = new File([blob], `cropped-${props.uploadFile.name}`, {
            type: 'image/png',
            lastModified: Date.now()
          })
          props.onSave(file)
        }
      }, 'image/png')
    } catch (error) {
      console.error('Ошибка при сохранении:', error)
    } finally {
      setIsLoading(false)
    }
  }

  onMount(() => {
    if (!containerRef || !imageRef || !canvasRef) return

    // Настраиваем обработчики изображения
    imageRef.onload = () => {
      if (!imageRef || !canvasRef) return

      const imgWidth = imageRef.naturalWidth
      const imgHeight = imageRef.naturalHeight

      setImageLoaded(true)

      // Настраиваем canvas размеры
      const canvasWidth = 500
      const canvasHeight = 500
      canvasRef.width = canvasWidth
      canvasRef.height = canvasHeight

      // Вычисляем масштаб для подгонки изображения в canvas
      const scaleX = (canvasWidth * 0.9) / imgWidth
      const scaleY = (canvasHeight * 0.9) / imgHeight
      const fitScale = Math.min(scaleX, scaleY)
      setScale(fitScale)

      // Настраиваем область обрезки (квадрат в центре)
      const cropSize = Math.min(canvasWidth, canvasHeight) * 0.4
      setCropData({
        x: (canvasWidth - cropSize) / 2,
        y: (canvasHeight - cropSize) / 2,
        width: cropSize,
        height: cropSize
      })

      drawImage()
    }

    imageRef.onerror = () => {
      console.error('Ошибка загрузки изображения для кропинга')
    }

    // Загружаем изображение
    imageRef.src = URL.createObjectURL(props.uploadFile.file)

    // Добавляем обработчики событий для canvas
    if (canvasRef) {
      canvasRef.addEventListener('mousedown', handleMouseDown)
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
    if (imageRef?.src) {
      URL.revokeObjectURL(imageRef.src)
    }
  })

  return (
    <div ref={containerRef} class={styles.cropperContainer}>
      <div class={styles.cropperCanvas}>
        {/* Скрытое изображение для загрузки и расчетов */}
        <img ref={imageRef} style={{ display: 'none' }} alt="Crop source" />

        {/* Canvas для отображения и кропинга */}
        <canvas
          ref={canvasRef}
          class={isDragging() ? 'dragging' : ''}
          style={{
            cursor: isDragging() ? 'grabbing' : 'grab',
            'max-width': '100%',
            'max-height': '400px'
          }}
        />
      </div>

      {/* Zoom controls */}
      <div class={clsx(styles.cropperControls, 'zoomControls')}>
        <button
          class="zoomControl"
          onClick={() => {
            const newScale = Math.max(0.1, scale() * 0.8)
            setScale(newScale)
            drawImage()
          }}
        >
          &minus;
        </button>
        <button
          class={clsx('zoomControl', 'zoomControlDefault')}
          onClick={() => {
            setScale(1)
            drawImage()
          }}
        >
          1:1
        </button>
        <button
          class="zoomControl"
          onClick={() => {
            const newScale = Math.min(3, scale() * 1.25)
            setScale(newScale)
            drawImage()
          }}
        >
          +
        </button>
      </div>

      <div class={styles.cropperControls}>
        <Show when={props.onDecline}>
          <Button variant="secondary" onClick={props.onDecline} value={t('Cancel')} />
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
