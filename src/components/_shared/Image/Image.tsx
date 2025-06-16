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
  const [loaded, setLoaded] = createSignal(false)

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

  // Генерируем srcSet для адаптивных изображений
  const imageSrcSet = () => {
    if (!local.src || !local.src.startsWith('http') || !others.width) return undefined
    // Исправляем вызов функции - передаем width как число
    return getCachedImageSrcSet(local.src, others.width)
  }

  // Обработка ошибок загрузки изображения
  const handleImageError = (e: Event) => {
    const currentRetries = retries()

    if (currentRetries < 1) {
      // Повторная попытка
      setRetries(currentRetries + 1)
      setLoaded(false) // Сбрасываем состояние загрузки

      // Добавляем параметр retry к URL
      const img = e.target as HTMLImageElement
      const url = new URL(img.src)
      url.searchParams.set('retry', String(currentRetries + 1))
      img.src = url.toString()
    } else {
      // Вызов callback родительского компонента
      setLoaded(false)
      const errorHandler = local.onError
      if (typeof errorHandler === 'function') {
        errorHandler(e as ErrorEvent & { currentTarget: HTMLImageElement; target: Element })
      }
    }
  }

  // Обработка успешной загрузки
  const handleImageLoad = (e: Event) => {
    setLoaded(true) // Триггерим перерисовку
    const loadHandler = local.onLoad
    if (typeof loadHandler === 'function') {
      loadHandler(e as Event & { currentTarget: HTMLImageElement; target: Element })
    }
  }

  // Preload критических изображений
  const preloadUrl = imageUrl()

  return (
    <>
      {preloadUrl && <Link rel="preload" as="image" href={preloadUrl} />}
      <img
        {...others}
        src={imageUrl()}
        srcSet={imageSrcSet()}
        alt={local.alt}
        onError={handleImageError}
        onLoad={handleImageLoad}
        loading="lazy"
        style={{
          opacity: loaded() ? 1 : 0.5,
          transition: 'opacity 0.3s ease',
          ...(typeof others.style === 'object' ? others.style : {})
        }}
      />
    </>
  )
}
