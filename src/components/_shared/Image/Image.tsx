import type { JSX } from 'solid-js'

import { Link } from '@solidjs/meta'
import { createSignal, onMount, splitProps } from 'solid-js'

import { getFileUrl } from '~/lib/getThumbUrl'

type Props = JSX.ImgHTMLAttributes<HTMLImageElement> & {
  width: number
  alt: string
}

export const Image = (props: Props) => {
  const [local, others] = splitProps(props, ['src', 'alt'])
  const [key, setKey] = createSignal(Date.now())
  const [loaded, setLoaded] = createSignal(false)
  const [retries, setRetries] = createSignal(0)

  // Используем ключ для принудительного обновления изображения
  const imageUrl = local.src?.startsWith('http')
    ? `${getFileUrl(local.src, { width: others.width })}&_k=${key()}`
    : local.src

  const imageSrcSet = [1, 33, 66, 100]
    .map(
      (pixelDensity) =>
        `${
          local.src?.startsWith('http')
            ? `${getFileUrl(local.src || '', { width: others.width * pixelDensity })}&_k=${key()}`
            : local.src
        } ${pixelDensity}x`
    )
    .join(', ')

  // Добавляем обработку ошибок для изображений
  const handleImageError = (e: Event) => {
    const img = e.target as HTMLImageElement

    // Увеличиваем счетчик попыток
    setRetries((prev: number) => prev + 1)

    if (retries() < 3) {
      console.warn(`[Image] Ошибка загрузки изображения (попытка ${retries()}): ${img.src}`)

      // Генерируем новый ключ для принудительного обновления
      setKey(Date.now())

      // Добавляем дополнительные параметры для обхода кеша
      const cacheBuster = `reload=${Date.now()}-${Math.random()}`
      const newSrc = `${img.src.split('&_k=')[0]}${img.src.includes('?') ? '&' : '?'}${cacheBuster}`

      // Устанавливаем новый src с небольшой задержкой
      setTimeout(() => {
        img.src = newSrc
      }, 100)
    } else {
      console.error(`[Image] Не удалось загрузить изображение после ${retries()} попыток: ${img.src}`)
    }
  }

  // Обработчик успешной загрузки
  const handleImageLoad = () => {
    setLoaded(true)
  }

  // Используем эффект для принудительной перезагрузки изображения при монтировании
  onMount(() => {
    // Принудительно обновляем ключ через небольшую задержку после монтирования
    setTimeout(() => {
      if (!loaded()) {
        setKey(Date.now())
      }
    }, 200)
  })

  return (
    <>
      <Link rel="preload" as="image" imagesrcset={imageSrcSet} href={imageUrl} crossorigin="anonymous" />
      <img
        src={imageUrl}
        alt={local.alt}
        srcSet={imageSrcSet}
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
