import { Link } from '@solidjs/meta'
import type { JSX } from 'solid-js'
import { createSignal, splitProps } from 'solid-js'
import { NoHydration } from 'solid-js/web'
import { getCdnUrl, getImageSrcSet } from '~/lib/imageCache'

type Props = JSX.ImgHTMLAttributes<HTMLImageElement> & {
  width: number
  alt: string
  /** Включить прогрессивную загрузку с blur-эффектом */
  progressive?: boolean
  /** Приоритет загрузки (для critical images) */
  priority?: 'high' | 'low' | 'auto'
}

export const Image = (props: Props) => {
  const [local, others] = splitProps(props, ['src', 'alt', 'onError', 'onLoad', 'progressive', 'priority'])
  const [retries, setRetries] = createSignal(0)
  const [loaded, setLoaded] = createSignal(false)
  const [lowResLoaded, setLowResLoaded] = createSignal(false)

  // Используем оптимизированный URL изображения (Vercel API + квотер)
  const imageUrl = () => {
    if (!local.src) return ''

    // Для локальных статических ресурсов возвращаем как есть (без обработки)
    if (local.src.startsWith('/')) {
      return local.src
    }

    // Для CDN изображений используем getCdnUrl с размером
    if (local.src.startsWith('http') && others.width) {
      return getCdnUrl(local.src, others.width)
    }

    // Для остальных случаев возвращаем как есть
    return local.src
  }

  // Генерируем URL для низкого разрешения (для прогрессивной загрузки)
  const lowResUrl = () => {
    if (!local.progressive || !local.src?.startsWith('http')) return undefined

    // Используем getCdnUrl для низкого разрешения (например, 200px)
    return getCdnUrl(local.src, 200)
  }

  // Генерируем srcSet для адаптивных изображений
  const imageSrcSet = () =>
    getImageSrcSet(local.src || '', [others.width, others.width / 2, others.width / 4, others.width / 8])

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
  return (
    <>
      {imageUrl() && <Link rel="preload" as="image" href={imageUrl()} />}

      {/* Прогрессивная загрузка: сначала низкое разрешение */}
      {local.progressive && lowResUrl() && (
        <NoHydration>
          <img
            src={lowResUrl()}
            alt=""
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              filter: 'blur(5px)',
              opacity: lowResLoaded() && !loaded() ? 1 : 0,
              transition: 'opacity 0.3s ease',
              'z-index': -1
            }}
            onLoad={() => setLowResLoaded(true)}
          />
        </NoHydration>
      )}

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
        style={{
          opacity: loaded() ? 1 : local.progressive && lowResLoaded() ? 0 : 0.5,
          // Объединяем transitions: opacity для загрузки + transform для hover-анимаций
          transition: 'opacity 0.3s ease, transform 0.3s ease-out',
          ...(typeof others.style === 'object' ? others.style : {})
        }}
      />
    </>
  )
}
