const scrollPosition = {
  top: 0,
  left: 0
}

export const saveScrollPosition = () => {
  if (window) {
    scrollPosition.top = window.scrollY
    scrollPosition.left = window.scrollX
  }
}

export const restoreScrollPosition = () => {
  window?.scroll({
    top: scrollPosition.top,
    left: scrollPosition.left
  })
}

export const scrollHandler = (elemId: string, offset = -100) => {
  const anchor = document.querySelector(`#${elemId}`)

  if (anchor && window) {
    console.debug('[scrollHandler] scroll to', anchor, offset)
    window?.scrollTo?.({
      top: anchor.getBoundingClientRect().top + offset,
      behavior: 'smooth'
    })
  }
}
