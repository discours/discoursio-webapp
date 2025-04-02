import { JSX, Show, createEffect, createSignal, on, onCleanup, onMount, untrack } from 'solid-js'
import { Button } from '~/components/_shared/Button'
import { useLocalize } from '~/context/localize'
import { Author, Reaction, Shout } from '~/graphql/schema/core.gen'
import { SortFunction } from '~/types/common'
import { restoreScrollPosition, saveScrollPosition } from '~/utils/scroll'
import { byCreated } from '~/utils/sort'

import styles from './LoadMoreWrapper.module.scss'

export type LoadMoreItems = Shout[] | Author[] | Reaction[]

/**
 * Параметры компонента для загрузки элементов с пагинацией
 * @interface LoadMoreProps
 * @property {Function} loadFunction - Функция загрузки, принимающая смещение и возвращающая Promise с элементами
 * @property {number} pageSize - Размер страницы для загрузки
 * @property {boolean} [hidden] - Флаг скрытия кнопки загрузки
 * @property {string} [size] - Размер кнопки (S/M/L)
 * @property {string} [loadMoreText] - Текст кнопки загрузки
 * @property {boolean} [useScrollTrigger] - Использовать автоматическую загрузку при скроллинге
 * @property {JSX.Element} children - Дочерние элементы
 */
type LoadMoreProps = {
  loadFunction: (offset: number) => Promise<LoadMoreItems | undefined>
  pageSize: number
  hidden?: boolean
  size?: 'S' | 'M' | 'L'
  loadMoreText?: string
  children: JSX.Element
  useScrollTrigger?: boolean
}

/**
 * Компонент для загрузки элементов с пагинацией
 * Поддерживает загрузку при нажатии кнопки или автоматически при скроллинге
 *
 * @component
 */
export const LoadMoreWrapper = (props: LoadMoreProps) => {
  const { t } = useLocalize()
  const [items, setItems] = createSignal<LoadMoreItems>([])
  const [offset, setOffset] = createSignal(0)
  const [isLoadMoreButtonVisible, setIsLoadMoreButtonVisible] = createSignal(!props.hidden)
  const [isLoading, setIsLoading] = createSignal(false)
  const [scrollWrapper, setScrollWrapper] = createSignal<HTMLDivElement | null>(null)
  const [initialLoadDone, setInitialLoadDone] = createSignal(false)
  let observer: IntersectionObserver | null = null

  // Генерируем уникальный идентификатор компонента на основе данных и URL
  const [componentId, setComponentId] = createSignal('')
  onMount(() => {
    // Создаем уникальный компонентный идентификатор
    const pageUrl = window.location.pathname
    const pageSize = props.pageSize.toString()
    const hiddenState = props.hidden ? 'hidden' : 'visible'
    const text = props.loadMoreText || 'default'
    const hash = window.crypto
      ? Array.from(window.crypto.getRandomValues(new Uint8Array(4)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      : Date.now().toString(36)

    setComponentId(`lmw_${pageUrl.replace(/\//g, '_')}_${pageSize}_${hiddenState}_${text}_${hash}`)
  })

  // Проверяем, была ли уже выполнена начальная загрузка
  const checkInitialLoadDone = () => {
    try {
      const key = `load_state_${componentId()}`
      return sessionStorage.getItem(key) === 'loaded'
    } catch {
      return false
    }
  }

  // Отмечаем, что начальная загрузка выполнена
  const markInitialLoadDone = () => {
    try {
      const key = `load_state_${componentId()}`
      sessionStorage.setItem(key, 'loaded')
      setInitialLoadDone(true)
    } catch {
      // Игнорируем ошибки sessionStorage
    }
  }

  // Отслеживаем количество загруженных элементов
  createEffect(
    on(items, (currentItems) => {
      if (Array.isArray(currentItems)) {
        console.log('[LoadMoreWrapper] Items updated:', currentItems.length)
        setOffset(currentItems.length)

        // Если получили меньше элементов, чем размер страницы, скрываем загрузчик
        if (currentItems.length % props.pageSize !== 0 && currentItems.length > 0) {
          setIsLoadMoreButtonVisible(false)
        }
      }
    })
  )

  /**
   * Загружает дополнительные элементы
   */
  const loadItems = async () => {
    // Проверяем состояние загрузки, используя untrack для предотвращения циклических зависимостей
    if (untrack(() => isLoading())) {
      //console.log('[LoadMoreWrapper] Already loading, skipping request')
      return
    }

    // console.log('[LoadMoreWrapper] Loading items from offset:', offset(), 'componentId:', componentId())
    // Устанавливаем флаг загрузки вне отслеживания реактивности
    untrack(() => setIsLoading(true))
    saveScrollPosition()

    try {
      const newItems = await props.loadFunction(offset())

      if (!Array.isArray(newItems) || newItems.length === 0) {
        console.log('[LoadMoreWrapper] No more items to load')
        untrack(() => {
          setIsLoadMoreButtonVisible(false)
          setInitialLoadDone(true)
          markInitialLoadDone()
        })
        return
      }

      console.log('[LoadMoreWrapper] Loaded new items:', newItems.length)

      // Обновляем список элементов вне отслеживания реактивности для предотвращения циклов
      untrack(() => {
        setItems((prev) => {
          // Создаем Set для быстрой проверки наличия элементов и избежания дубликатов
          const existingIds = new Set(prev.map((item) => item.id))
          const uniqueNewItems = newItems.filter((item) => !existingIds.has(item.id))

          console.log('[LoadMoreWrapper] Unique new items:', uniqueNewItems.length)

          // Скрываем кнопку загрузки, если получили меньше элементов, чем размер страницы
          if (uniqueNewItems.length < props.pageSize) {
            setIsLoadMoreButtonVisible(false)
          }

          // Отмечаем, что начальная загрузка выполнена
          setInitialLoadDone(true)
          markInitialLoadDone()

          return [...prev, ...uniqueNewItems].sort(byCreated as SortFunction<unknown>) as LoadMoreItems
        })
      })
    } catch (error) {
      console.error('[LoadMoreWrapper] Error loading items:', error)
      untrack(() => {
        setInitialLoadDone(true)
        markInitialLoadDone()
      })
    } finally {
      // Сбрасываем флаг загрузки вне отслеживания реактивности
      untrack(() => setIsLoading(false))
      restoreScrollPosition()
    }
  }

  /**
   * Настраивает IntersectionObserver для отслеживания скролла
   */
  const setupIntersectionObserver = () => {
    const loaderRef = scrollWrapper()
    if (!props.useScrollTrigger || !loaderRef) return

    observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !untrack(() => isLoading()) &&
          untrack(() => isLoadMoreButtonVisible())
        ) {
          console.log('[LoadMoreWrapper] IntersectionObserver triggered load')
          loadItems()
        }
      },
      {
        threshold: 0.1, // Триггер при видимости 10% элемента
        rootMargin: '200px' // Запускаем загрузку немного раньше
      }
    )

    observer.observe(loaderRef)
  }

  onMount(() => {
    // Проверяем локальное состояние и sessionStorage
    if (untrack(() => initialLoadDone()) || checkInitialLoadDone()) {
      //console.log('[LoadMoreWrapper] Initial load already done, skipping for', componentId())
      return
    }

    //console.log('[LoadMoreWrapper] Mounted, initial load for', componentId())
    loadItems()

    if (props.useScrollTrigger) {
      // Добавляем небольшую задержку для настройки наблюдателя, чтобы DOM успел обновиться
      setTimeout(setupIntersectionObserver, 100)
    }
  })

  onCleanup(() => {
    const loaderRef = scrollWrapper()
    if (observer && loaderRef) {
      observer.unobserve(loaderRef)
      observer.disconnect()
    }

    // Очищаем состояние при размонтировании для предотвращения проблем при перемонтировании
    untrack(() => {
      setInitialLoadDone(false)
      setItems([])
      setOffset(0)
    })
  })

  return (
    <>
      {props.children}

      <div ref={setScrollWrapper} class={styles.loadMoreTrigger}>
        <Show when={isLoadMoreButtonVisible() && !props.useScrollTrigger}>
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
          <div class={styles.loadingIndicator}>{t('Loading more comments...')}</div>
        </Show>
      </div>
    </>
  )
}
