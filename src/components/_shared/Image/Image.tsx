import { Link } from '@solidjs/meta'
import type { JSX } from 'solid-js'
import { createSignal, splitProps } from 'solid-js'
import { getCdnUrl, getImageSrcSet } from '~/lib/imageCache'

type Props = JSX.ImgHTMLAttributes<HTMLImageElement> & {
  width: number
  alt: string
  /** Приоритет загрузки (для critical images) */
  priority?: 'high' | 'low' | 'auto'
}

export const Image = (props: Props) => {
  const [local, others] = splitProps(props, ['src', 'alt', 'onError', 'onLoad', 'priority'])
  const [retries, setRetries] = createSignal(0)

  // Используем оптимизированный URL изображения (Vercel API + квотер)
  const imageUrl = () => {
    if (!local.src) return ''

    // Для локальных статических ресурсов возвращаем как есть (без обработки)
    if (local.src.startsWith('/')) {
      return local.src
    }

    // Для CDN изображений используем getCdnUrl с размером
    // NOTE: getCdnUrl извлекает только filename, убирая production/image/ префиксы
    if (local.src.startsWith('http')) {
      return getCdnUrl(local.src, others.width)
    }

    // Для остальных случаев возвращаем как есть
    return local.src
  }

  // Генерируем srcSet для адаптивных изображений
  const imageSrcSet = () => {
    if (!local.src || !others.width) return ''
    return getImageSrcSet(local.src || '', [others.width, Math.floor(others.width * 0.5)])
  }

  // Обработка ошибок загрузки изображения
  const handleImageError = (e: Event) => {
    const currentRetries = retries()

    if (currentRetries < 1) {
      // Повторная попытка
      setRetries(currentRetries + 1)

      // Добавляем параметр retry к URL
      const img = e.target as HTMLImageElement
      const url = new URL(img.src)
      url.searchParams.set('retry', String(currentRetries + 1))
      img.src = url.toString()
    } else {
      // Вызов callback родительского компонента
      const errorHandler = local.onError
      if (typeof errorHandler === 'function') {
        errorHandler(e as ErrorEvent & { currentTarget: HTMLImageElement; target: Element })
      }
    }
  }

  // Обработка успешной загрузки
  const handleImageLoad = (e: Event) => {
    const loadHandler = local.onLoad
    if (typeof loadHandler === 'function') {
      loadHandler(e as Event & { currentTarget: HTMLImageElement; target: Element })
    }
  }

  return (
    <>
      {imageUrl() && <Link rel="preload" as="image" href={imageUrl()} />}

      {/* Основное изображение */}
      <img
        {...others}
        src={imageUrl()}
        srcSet={imageSrcSet()}
        alt={local.alt}
        onError={handleImageError}
        onLoad={handleImageLoad}
        loading={local.priority === 'high' ? 'eager' : 'lazy'}
        fetchpriority={local.priority || 'auto'}
      />
    </>
  )
}
