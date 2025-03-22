import { JSX, Show, createEffect, createSignal, on, onMount } from 'solid-js'
import { Button } from '~/components/_shared/Button'
import { useLocalize } from '~/context/localize'
import { Author, Reaction, Shout } from '~/graphql/schema/core.gen'
import { SortFunction } from '~/types/common'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { byCreated } from '~/utils/sort'

import styles from './LoadMoreWrapper.module.scss'

export type LoadMoreItems = Shout[] | Author[] | Reaction[]

type LoadMoreProps = {
  loadFunction: (offset: number) => Promise<LoadMoreItems | undefined>
  pageSize: number
  hidden?: boolean
  size?: 'S' | 'M' | 'L'
  loadMoreText?: string
  children: JSX.Element
  useScrollTrigger?: boolean
}

export const LoadMoreWrapper = (props: LoadMoreProps) => {
  const { t } = useLocalize()
  const [items, setItems] = createSignal<LoadMoreItems>([])
  const [offset, setOffset] = createSignal(0)
  const [isLoadMoreButtonVisible, setIsLoadMoreButtonVisible] = createSignal(props.hidden)
  const [isLoading, setIsLoading] = createSignal(false)
  const [scrollWrapper, setScrollWrapper] = createSignal<HTMLDivElement | null>(null)

  createEffect(
    on(items, (iii) => {
      // console.debug('LoadMoreWrapper.fx:', iii)
      if (Array.isArray(iii)) {
        setIsLoadMoreButtonVisible(iii.length - offset() >= 0)
        setOffset(iii.length)
      }
    })
  )

  const loadItems = async () => {
    if (isLoading()) return // Предотвращаем множественные запросы

    // console.debug('LoadMoreWrapper.loadItems offset:', offset())
    setIsLoading(true)
    saveScrollPosition()
    const newItems = await props.loadFunction(offset())
    if (!Array.isArray(newItems)) {
      setIsLoading(false)
      return
    }
    if (newItems.length === 0) setIsLoadMoreButtonVisible(false)
    else
      setItems(
        (prev) =>
          Array.from(new Set([...prev, ...newItems])).sort(
            byCreated as SortFunction<unknown>
          ) as LoadMoreItems
      )
    setIsLoading(false)
    restoreScrollPosition()
    // console.debug('LoadMoreWrapper.loadItems loaded:', newItems.length)
  }

  // Настройка обнаружения скроллинга до конца списка
  const setupIntersectionObserver = () => {
    const wrapper = scrollWrapper()
    if (!props.useScrollTrigger || !wrapper) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading() && isLoadMoreButtonVisible()) {
          loadItems()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    observer.observe(wrapper)
    return () => observer.unobserve(wrapper)
  }
  onMount(() => {
    setScrollWrapper(props.useScrollTrigger ? document.createElement('div') : null)
    loadItems()
    setupIntersectionObserver()
  })

  return (
    <>
      {props.children}
      <div ref={setScrollWrapper}>
        <Show when={isLoadMoreButtonVisible() && !props.hidden && !props.useScrollTrigger}>
          <div class={styles.loadMoreWrapper}>
            <Button
              onClick={loadItems}
              disabled={isLoading()}
              size={props.size}
              value={t(props.loadMoreText || 'Load more')}
              title={`${items().length} ${t('loaded')}`}
            />
          </div>
        </Show>
        <Show when={isLoading() && props.useScrollTrigger}>
          <div class={styles.loadMoreWrapper}>
            <div class={styles.loadingIndicator}>{t('Loading more...')}</div>
          </div>
        </Show>
      </div>
    </>
  )
}
