import { useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js'
import SwiperCore from 'swiper'
import { HashNavigation, Manipulation, Navigation, Pagination } from 'swiper/modules'
import { throttle } from 'throttle-debounce'
import { MediaItem } from '~/graphql/generated/graphql'
import { getCdnUrl } from '~/lib/imageCache'
import { Icon } from '../Icon'
import { Image } from '../Image'
import { Lightbox } from '../Lightbox'
import styles from './Swiper.module.scss'
import { SwiperRef } from './swiper'

type Props = {
  images: MediaItem[]
  onImagesAdd?: (value: MediaItem[]) => void
  onImagesSorted?: (value: MediaItem[]) => void
  onImageDelete?: (mediaItemIndex: number) => void
  onImageChange?: (index: number, value: MediaItem) => void
}

const MIN_WIDTH = 540

export const ImageSwiper = (props: Props) => {
  let mainSwipeRef: SwiperRef | null
  let thumbSwipeRef: SwiperRef | null
  let swiperMainContainer: HTMLDivElement | null
  const [slideIndex, setSlideIndex] = createSignal(0)
  const [isMobileView, setIsMobileView] = createSignal(false)
  const [selectedImage, setSelectedImage] = createSignal<string>('')
  const [searchParams, changeSearchParams] = useSearchParams<{ slide: string }>()

  const handleSlideChange = () => {
    const activeIndex = mainSwipeRef?.swiper.activeIndex || 0
    thumbSwipeRef?.swiper.slideTo(activeIndex)
    setSlideIndex(activeIndex)
    changeSearchParams({ slide: `${activeIndex + 1}` })
  }

  createEffect(
    on(
      () => props.images.length,
      (_) => {
        mainSwipeRef?.swiper.update()
        thumbSwipeRef?.swiper.update()
      },
      { defer: true }
    )
  )

  onMount(async () => {
    const { register } = await import('swiper/element/bundle')
    register()
    SwiperCore.use([Pagination, Navigation, Manipulation, HashNavigation])
    while (!mainSwipeRef?.swiper) {
      await new Promise((resolve) => setTimeout(resolve, 10)) // wait 10 ms
    }
    mainSwipeRef?.swiper.on('slideChange', handleSlideChange)
    const initialSlide = searchParams?.slide ? Number.parseInt(searchParams?.slide, 10) - 1 : 0
    if (initialSlide && !Number.isNaN(initialSlide) && initialSlide < props.images.length) {
      mainSwipeRef?.swiper.slideTo(initialSlide, 0)
    } else {
      changeSearchParams({ slide: '1' })
    }

    mainSwipeRef?.swiper.init()
  })

  onMount(() => {
    const updateDirection = () => {
      const width = window.innerWidth
      setIsMobileView(width < MIN_WIDTH)
    }

    updateDirection()

    const handleResize = throttle(100, () => {
      updateDirection()
    })

    window.addEventListener('resize', handleResize)

    onCleanup(() => {
      window.removeEventListener('resize', handleResize)
    })
  })

  const openLightbox = (image: string) => {
    setSelectedImage(image)
  }

  const handleLightboxClose = () => {
    setSelectedImage('')
  }

  const handleImageClick = (imageIndex: number) => {
    const image: MediaItem = props.images[imageIndex]
    openLightbox(image.source || '')
  }

  return (
    <div class={clsx(styles.Swiper, styles.articleMode, { [styles.mobileView]: isMobileView() })}>
      <div class={styles.container} ref={(el) => (swiperMainContainer = el)}>
        <Show when={props.images.length > 0}>
          <div class={clsx(styles.holder, styles.thumbsHolder)}>
            <div class={styles.thumbs}>
              <swiper-container
                class={'thumbSwiper'}
                ref={(el) => (thumbSwipeRef = el)}
                slides-per-view={'auto'}
                space-between={isMobileView() ? 20 : 10}
                auto-scroll-offset={1}
                watch-overflow={true}
                watch-slides-visibility={true}
                direction={'horizontal'}
                slides-per-group-auto={true}
                hash-navigation={{
                  watchState: true
                }}
              >
                <For each={props.images}>
                  {(slide, index) => (
                    <swiper-slide virtual-index={index()} style={{ width: 'auto', height: 'auto' }}>
                      <div
                        class={clsx(styles.imageThumb)}
                        style={{
                          'background-image': `url(${getCdnUrl(slide.url || '')})`
                        }}
                      />
                    </swiper-slide>
                  )}
                </For>
              </swiper-container>
              <div
                class={clsx(styles.navigation, styles.thumbsNav, styles.prev, {
                  [styles.disabled]: slideIndex() === 0
                })}
                onClick={() => thumbSwipeRef?.swiper.slidePrev()}
              >
                <Icon name="swiper-l-arr" class={styles.icon} />
              </div>
              <div
                class={clsx(styles.navigation, styles.thumbsNav, styles.next, {
                  [styles.disabled]: slideIndex() + 1 === props.images.length
                })}
                onClick={() => thumbSwipeRef?.swiper.slideNext()}
              >
                <Icon name="swiper-r-arr" class={styles.icon} />
              </div>
            </div>
          </div>
          <div class={styles.holder}>
            <swiper-container
              ref={(el) => (mainSwipeRef = el)}
              slides-per-view={1}
              thumbs-swiper={'.thumbSwiper'}
              observer={true}
              space-between={isMobileView() ? 20 : 10}
            >
              <For each={props.images}>
                {(slide, index) => (
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-expect-error
                  <swiper-slide lazy="true" virtual-index={index()} data-hash={String(index() + 1)}>
                    <div class={styles.image} onClick={() => handleImageClick(index())}>
                      <Image src={slide.url || ''} alt={slide.title || ''} width={800} />
                    </div>
                  </swiper-slide>
                )}
              </For>
            </swiper-container>
            <div
              class={clsx(styles.navigation, styles.prev, {
                [styles.disabled]: slideIndex() === 0
              })}
              onClick={() => mainSwipeRef?.swiper.slidePrev()}
            >
              <Icon name="swiper-l-arr" class={styles.icon} />
            </div>
            <div
              class={clsx(styles.navigation, styles.next, {
                [styles.disabled]: slideIndex() + 1 === props.images.length
              })}
              onClick={() => mainSwipeRef?.swiper.slideNext()}
            >
              <Icon name="swiper-r-arr" class={styles.icon} />
            </div>
            <div class={styles.counter}>
              {slideIndex() + 1} / {props.images.length}
            </div>
          </div>
        </Show>
      </div>
      <div class={styles.slideDescription}>
        <Show when={props.images[slideIndex()]?.title}>
          <div class={styles.articleTitle}>{props.images[slideIndex()].title}</div>
        </Show>
        <Show when={props.images[slideIndex()]?.source}>
          <div class={styles.source}>{props.images[slideIndex()].source}</div>
        </Show>
        <Show when={props.images[slideIndex()]?.body}>
          <div class={styles.body} innerHTML={props.images[slideIndex()].body || ''} />
        </Show>
      </div>

      <Show when={selectedImage()}>
        <Lightbox image={selectedImage()} onClose={handleLightboxClose} />
      </Show>
    </div>
  )
}
