import { clsx } from 'clsx'
import { JSX, Show, createEffect, createSignal } from 'solid-js'

import { useOutsideClickHandler } from '~/lib/useOutsideClickHandler'

import styles from './Popup.module.scss'

type HorizontalAnchor = 'center' | 'right'

export type PopupProps = {
  containerCssClass?: string
  popupCssClass?: string
  trigger: JSX.Element
  children: JSX.Element
  onVisibilityChange?: (isVisible: boolean) => void
  horizontalAnchor?: HorizontalAnchor
  variant?: 'tiny'
  closePopup?: boolean
  keepOpen?: boolean
}

export const Popup = (props: PopupProps) => {
  const [isVisible, setIsVisible] = createSignal(false)
  let containerRef: HTMLElement | undefined
  let closeTimeout: number | undefined

  const closePopup = () => {
    if (props.keepOpen) {
      closeTimeout = window.setTimeout(() => {
        setIsVisible(false)
        props.onVisibilityChange?.(false)
      }, 500)
      return
    }
    setIsVisible(false)
    props.onVisibilityChange?.(false)
  }

  const handleMouseEnter = () => {
    if (closeTimeout) {
      clearTimeout(closeTimeout)
      closeTimeout = undefined
    }
  }

  useOutsideClickHandler({
    containerRef: containerRef,
    predicate: () => isVisible() && !props.keepOpen,
    handler: () => closePopup()
  })

  createEffect(() => {
    if (props.closePopup) {
      closePopup()
    }
  })

  const toggle = () => setIsVisible((oldVisible) => !oldVisible)

  return (
    <span
      class={clsx(styles.container, props.containerCssClass)}
      ref={(el) => (containerRef = el)}
      onMouseLeave={props.keepOpen ? closePopup : undefined}
      onMouseEnter={props.keepOpen ? handleMouseEnter : undefined}
    >
      <span class={styles.trigger} onClick={toggle}>
        {props.trigger}
      </span>
      <Show when={isVisible()}>
        <div
          class={clsx(styles.popup, props.popupCssClass, {
            [styles.horizontalAnchorCenter]: props.horizontalAnchor === 'center',
            [styles.horizontalAnchorRight]: props.horizontalAnchor === 'right',
            [styles.tiny]: props.variant === 'tiny'
          })}
        >
          {props.children}
        </div>
      </Show>
    </span>
  )
}
