// Функция для загрузки скрипта GA
export const loadGAScript = (id: string) => {
  return new Promise<void>((resolve, reject) => {
    if (document.getElementById('ga-script')) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.id = 'ga-script'
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Analytics'))
    document.head.appendChild(script)
  })
}

// Функция для инициализации GA
export const initGA = (id: string) => {
  const w = window as Window
  if (w) {
    // @ts-expect-error
    // biome-ignore lint/suspicious/noExplicitAny: ga-script
    w.dataLayer = (w.dataLayer as any) || []
    // biome-ignore lint/suspicious/noExplicitAny: ga-script
    function gtag(...args: any[]) {
      // @ts-expect-error
      w.dataLayer.push(args)
    }
    gtag('js', new Date())
    gtag('config', id)
  }
}
