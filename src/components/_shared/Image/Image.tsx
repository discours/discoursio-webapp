import type { JSX } from 'solid-js'

import { Link } from '@solidjs/meta'
import { createSignal, splitProps } from 'solid-js'

import { getCachedImageSrcSet, getCachedImageUrl } from '~/lib/imageCache'

type Props = JSX.ImgHTMLAttributes<HTMLImageElement> & {
  width: number
  alt: string
}

export const Image = (props: Props) => {
  const [local, others] = splitProps(props, ['src', 'alt', 'onError', 'onLoad'])
  const [retries, setRetries] = createSignal(0)
  const [hasError, setHasError] = createSignal(false)

  // Используем кешированный URL изображения
  const imageUrl = () => {
    if (!local.src) return ''

    // Для внешних URL используем кеширование
    if (local.src.startsWith('http')) {
      return getCachedImageUrl(local.src, { width: others.width })
    }

    // Для локальных ресурсов возвращаем как есть
    return local.src
  }

  // Получаем srcSet для адаптивных изображений
  const imageSrcSet = () => {
    if (!local.src || !local.src.startsWith('http')) return ''
    return getCachedImageSrcSet(local.src, others.width)
  }

  // Обработчик ошибок загрузки изображений
  const handleImageError = (e: Event) => {
    const img = e.target as HTMLImageElement

    if (retries() < 1 && !hasError()) {
      setRetries((prev) => prev + 1)
      console.warn(`[Image] Ошибка загрузки изображения (попытка ${retries() + 1}): ${img.src}`)

      // Добавляем параметр для повторной попытки
      const separator = img.src.includes('?') ? '&' : '?'
      const newSrc = `${img.src}${separator}retry=${Date.now()}`

      setTimeout(() => {
        img.src = newSrc
      }, 500)
    } else {
      console.error(`[Image] Не удалось загрузить изображение после ${retries() + 1} попыток: ${img.src}`)
      setHasError(true)

      // Вызываем callback родительского компонента
      if (typeof local.onError === 'function') {
        local.onError(e as ErrorEvent & { currentTarget: HTMLImageElement; target: Element })
      }
    }
  }

  // Обработчик успешной загрузки
  const handleImageLoad = (e: Event) => {
    setHasError(false)
    setRetries(0)

    if (typeof local.onLoad === 'function') {
      local.onLoad(e as Event & { currentTarget: HTMLImageElement; target: Element })
    }
  }

  return (
    <>
      <Link
        rel="preload"
        as="image"
        imagesrcset={imageSrcSet()}
        href={imageUrl()}
        crossorigin="anonymous"
      />
      <img
        src={imageUrl()}
        alt={local.alt || ''}
        srcSet={imageSrcSet()}
        onError={handleImageError}
        onLoad={handleImageLoad}
        loading="eager"
        fetchpriority="high"
        decoding="async"
        crossorigin="anonymous"
        {...others}
      />
    </>
  )
}
