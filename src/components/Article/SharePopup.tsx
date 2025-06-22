import { createEffect, createSignal } from 'solid-js'
import type { PopupProps } from '../_shared/Popup'

import { Popup } from '../_shared/Popup'
import { ShareLinks } from '../_shared/ShareLinks'

type SharePopupProps = {
  title: string
  shareUrl: string
  imageUrl: string
  description: string
  onVisibilityChange?: (value: boolean) => void
} & Omit<PopupProps, 'children'>

export const getShareUrl = (params: { pathname?: string } = {}) => {
  if (typeof location === 'undefined') return ''
  const pathname = params.pathname ?? location.pathname
  return location.origin + pathname
}

export const SharePopup = (props: SharePopupProps) => {
  const [isVisible, setIsVisible] = createSignal(false)
  createEffect(() => {
    if (props.onVisibilityChange) {
      props.onVisibilityChange(isVisible())
    }
  })

  return (
    <Popup {...props} onVisibilityChange={(value) => setIsVisible(value)}>
      <ShareLinks
        variant="inPopup"
        title={props.title}
        shareUrl={props.shareUrl}
        imageUrl={props.imageUrl}
        description={props.description}
      />
    </Popup>
  )
}
