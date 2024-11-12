import { clsx } from 'clsx'
import { For, Show, onMount } from 'solid-js'
import SwiperCore from 'swiper'
import { Manipulation, Navigation, Pagination } from 'swiper/modules'

import { Shout } from '~/graphql/schema/core.gen'
import { ArticleCard } from '../../Feed/ArticleCard'
import { Icon } from '../Icon'
import { ShowOnlyOnClient } from '../ShowOnlyOnClient'

import { SwiperRef } from './swiper'

import { Row1 } from '../../Feed/Row1'
import { Row2 } from '../../Feed/Row2'
import styles from './Swiper.module.scss'

type Props = {
  slides: Shout[]
  title?: string
}

export const ArticleCardSwiper = (props: Props) => {
  let mainSwipeRef: SwiperRef | null

  onMount(async () => {
    if (props.slides?.length > 1) {
      // console.debug(props.slides)
      const { register } = await import('swiper/element/bundle')
      register()
      SwiperCore.use([Pagination, Navigation, Manipulation])
    }
  })

  return (
    <Show when={props.slides && props.slides.length > 0}>
      <ShowOnlyOnClient>
        <div
          class={clsx({
            [styles.Swiper]: props.slides?.length > 1,
            [styles.articleMode]: true,
            [styles.ArticleCardSwiper]: props.slides?.length > 1
          })}
        >
          <Show when={props.title}>
            <div class="wide-container">
              <div class="row">
                <div class="col-md-12">
                  <h2 class={styles.sliderTitle}>{props.title}</h2>
                </div>
              </div>
            </div>
          </Show>
          <div class={styles.container}>
            <Show when={props.slides?.length > 0}>
              <Show when={props.slides.length !== 1} fallback={<Row1 article={props.slides[0]} />}>
                <Show when={props.slides.length !== 2} fallback={<Row2 articles={props.slides} />}>
                  <div class={styles.holder}>
                    <swiper-container
                      ref={(el) => (mainSwipeRef = el)}
                      centered-slides={true}
                      observer={true}
                      space-between={10}
                      breakpoints={{
                        576: { spaceBetween: 20, slidesPerView: 1.5 },
                        992: { spaceBetween: 52, slidesPerView: 1.5 }
                      }}
                      round-lengths={true}
                      loop={true}
                      speed={800}
                      autoplay={{
                        disableOnInteraction: false,
                        delay: 6000,
                        pauseOnMouseEnter: true
                      }}
                    >
                      <For each={props.slides}>
                        {(slide, index) => (
                          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                          // @ts-ignore
                          <swiper-slide virtual-index={index()}>
                            <ArticleCard
                              article={slide}
                              settings={{
                                additionalClass: 'swiper-slide',
                                isFloorImportant: true,
                                isWithCover: true,
                                nodate: true
                              }}
                              desktopCoverSize="L"
                            />
                          </swiper-slide>
                        )}
                      </For>
                    </swiper-container>
                    <div
                      class={clsx(styles.navigation, styles.prev)}
                      onClick={() => mainSwipeRef?.swiper.slidePrev()}
                    >
                      <Icon name="swiper-l-arr" class={styles.icon} />
                    </div>
                    <div
                      class={clsx(styles.navigation, styles.next)}
                      onClick={() => mainSwipeRef?.swiper.slideNext()}
                    >
                      <Icon name="swiper-r-arr" class={styles.icon} />
                    </div>
                  </div>
                </Show>
              </Show>
            </Show>
          </div>
        </div>
      </ShowOnlyOnClient>
    </Show>
  )
}
