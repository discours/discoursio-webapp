import { createSignal, JSX, onMount, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import usePopper from 'solid-popper'

import styles from './Popover.module.scss'

type Props = {
  children: (setTooltipEl: (el: HTMLElement | null) => void) => JSX.Element
  content: string | JSX.Element
  disabled?: boolean
}

export const Popover = (props: Props) => {
  const [show, setShow] = createSignal(false)
  const [anchor, setAnchor] = createSignal<HTMLElement>()
  const [popper, setPopper] = createSignal<HTMLElement>()
  const tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`

  usePopper(anchor, popper, {
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: [0, 8]
        }
      },
      {
        name: 'flip',
        options: {
          fallbackPlacements: ['top', 'bottom']
        }
      }
    ]
  })

  const showEvents = ['mouseenter', 'focus']
  const hideEvents = ['mouseleave', 'blur']

  const handleMouseOver = () => setShow(true)
  const handleMouseOut = () => setShow(false)

  const setAnchorWithAria = (el: HTMLElement | null) => {
    setAnchor(el || undefined)
    if (el && !props.disabled) {
      el.setAttribute('aria-describedby', tooltipId)
    }
  }

  if (!props.disabled) {
    onMount(() => {
      if (!anchor()) return
      showEvents.forEach((event) => {
        anchor()?.addEventListener(event, handleMouseOver)
      })
      hideEvents.forEach((event) => {
        anchor()?.addEventListener(event, handleMouseOut)
      })
      return () => {
        showEvents.forEach((event) => {
          anchor()?.removeEventListener(event, handleMouseOver)
        })
        hideEvents.forEach((event) => {
          anchor()?.removeEventListener(event, handleMouseOut)
        })
      }
    })
  }

  return (
    <>
      {props.children(setAnchorWithAria)}
      <Portal>
        <Show when={show() && !props.disabled}>
          <div ref={setPopper} class={styles.tooltip} role="tooltip" id={tooltipId} aria-hidden={!show()}>
            {props.content}
            <div class={styles.arrow} data-popper-arrow={true} />
          </div>
        </Show>
      </Portal>
    </>
  )
}
