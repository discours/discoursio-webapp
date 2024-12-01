import { clsx } from 'clsx'
import { For, Show, createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
import { debounce, throttle } from 'throttle-debounce'

import { useLocalize } from '~/context/localize'
import { DEFAULT_HEADER_OFFSET } from '~/context/ui'
import { isDesktop } from '~/lib/mediaQuery'
import { Icon } from '../Icon'

import styles from './TableOfContents.module.scss'

interface Props {
  variant: 'article' | 'editor'
  parentSelector: string
  body: string
}

const isInViewport = (el: Element): boolean => {
  const rect = el.getBoundingClientRect()
  return rect.top <= DEFAULT_HEADER_OFFSET + 24 // default offset + 1.5em (default header margin-top)
}
const scrollToHeader = (element: HTMLElement) => {
  window?.scrollTo({
    behavior: 'smooth',
    top:
      element.getBoundingClientRect().top -
      document?.body.getBoundingClientRect().top -
      DEFAULT_HEADER_OFFSET
  })
}

export const TableOfContents = (props: Props) => {
  const { t } = useLocalize()
  const [headings, setHeadings] = createSignal<HTMLElement[]>([])
  const [areHeadingsLoaded, setAreHeadingsLoaded] = createSignal<boolean>(false)
  const [activeHeaderIndex, setActiveHeaderIndex] = createSignal<number>(-1)
  const [isVisible, setIsVisible] = createSignal<boolean>(props.variant === 'article')
  const [isDocumentReady, setIsDocumentReady] = createSignal<boolean>(false)

  const toggleIsVisible = () => {
    setIsVisible((visible) => !visible)
  }

  setIsVisible(isDesktop())

  const updateHeadings = () => {
    if (!isDocumentReady()) return
    const parent = document?.querySelector(props.parentSelector)
    if (parent) {
      setHeadings(
        // eslint-disable-next-line unicorn/prefer-spread
        Array.from(parent.querySelectorAll<HTMLElement>('h1, h2, h3, h4'))
      )
    }
    setAreHeadingsLoaded(true)
  }

  const debouncedUpdateHeadings = debounce(500, updateHeadings)

  const updateActiveHeader = throttle(50, () => {
    if (!isDocumentReady()) return
    const newActiveIndex = headings().findLastIndex((heading) => isInViewport(heading))
    setActiveHeaderIndex(newActiveIndex)
  })

  createEffect(
    on(
      () => props.body,
      (_) => {
        if (isDocumentReady()) {
          debouncedUpdateHeadings()
        }
      }
    )
  )

  onMount(() => {
    setIsDocumentReady(true)
    debouncedUpdateHeadings()
    window.addEventListener('scroll', updateActiveHeader)
    onCleanup(() => window.removeEventListener('scroll', updateActiveHeader))

    window.console.log(headings())
  })

  return (
    <Show
      when={
        areHeadingsLoaded() && (props.variant === 'article' ? headings().length > 2 : headings().length > 1)
      }
    >
      <div
        class={clsx(styles.TableOfContentsFixedWrapper, {
          [styles.TableOfContentsFixedWrapperLefted]: props.variant === 'editor'
        })}
      >
        <div class={styles.TableOfContentsContainer} data-custom-scroll="on">
          <Show when={isVisible()}>
            <div class={styles.TableOfContentsContainerInner}>
              <div class={styles.TableOfContentsHeader}>
                <p class={styles.TableOfContentsHeading}>{t('Contents')}</p>
              </div>
              <ul class={styles.TableOfContentsHeadingsList}>
                <For each={headings()}>
                  {(h, index) => (
                    <li>
                      <button
                        class={clsx(styles.TableOfContentsHeadingsItem, {
                          [styles.TableOfContentsHeadingsItemH3]: h.nodeName === 'H3',
                          [styles.TableOfContentsHeadingsItemH4]: h.nodeName === 'H4',
                          [styles.active]: index() === activeHeaderIndex()
                        })}
                        innerHTML={h.textContent || ''}
                        onClick={(e) => {
                          e.preventDefault()
                          scrollToHeader(h)
                        }}
                      />
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Show>

          <button
            class={clsx(
              styles.TableOfContentsPrimaryButton,
              {
                [styles.TableOfContentsPrimaryButtonLefted]: props.variant === 'editor' && !isVisible()
              },
              'd-xl-block'
            )}
            onClick={(e) => {
              e.preventDefault()
              toggleIsVisible()
            }}
            title={isVisible() ? t('Hide table of contents') : t('Show table of contents')}
          >
            <Show when={isVisible()} fallback={<Icon name="show-table-of-contents" class="icon" />}>
              {props.variant === 'editor' ? (
                <Icon name="hide-table-of-contents" class="icon" />
              ) : (
                <Icon name="hide-table-of-contents-2" class="icon" />
              )}
            </Show>
          </button>

          <Show when={isVisible()}>
            <button
              class={clsx(styles.TableOfContentsCloseButton, 'd-xl-none')}
              onClick={(e) => {
                e.preventDefault()
                toggleIsVisible()
              }}
              title={isVisible() ? t('Hide table of contents') : t('Show table of contents')}
            >
              <Icon name="close-white" class="icon" />
            </button>
          </Show>
        </div>

        <Show when={!isVisible()}>
          <button
            class={clsx(
              styles.TableOfContentsPrimaryButton,
              {
                [styles.TableOfContentsPrimaryButtonLefted]: props.variant === 'editor' && !isVisible()
              },
              'd-xl-none'
            )}
            onClick={(e) => {
              e.preventDefault()
              toggleIsVisible()
            }}
            title={isVisible() ? t('Hide table of contents') : t('Show table of contents')}
          >
            <Icon name="hide-table-of-contents-2" class="icon" />
          </button>
        </Show>
      </div>
    </Show>
  )
}
