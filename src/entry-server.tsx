// @refresh reload
import { createHandler, StartServer } from '@solidjs/start/server'
import { ErrorBoundary, Suspense } from 'solid-js'
import { Loading } from './components/_shared/Loading'
import { useLocalize } from './context/localize'

// biome-ignore lint/suspicious/noExplicitAny: ok
const ServerErrorFallback = (err: any) => {
  console.error('[Server] Error during SSR:', err)
  console.error('[Server] Stack trace:', err?.stack)

  // В production возвращаем минимальный HTML
  if (process.env.NODE_ENV === 'production') {
    return <Loading />
  }

  // В dev режиме показываем детали
  return (
    <div style={{ padding: '20px', background: '#fee', color: '#c00' }}>
      <h1>Server Error</h1>
      <pre style={{ 'white-space': 'pre-wrap' }}>{err?.toString()}</pre>
    </div>
  )
}

export default createHandler(() => {
  const { lang } = useLocalize()

  // Безопасное получение языка с fallback
  const currentLang = (() => {
    try {
      return typeof lang === 'function' ? lang() : 'ru'
    } catch {
      return 'ru'
    }
  })()

  return (
    <StartServer
      document={({ assets, children, scripts }) => {
        return (
          <html lang={currentLang}>
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <link rel="icon" href="/favicon.ico" />
              {assets}
            </head>
            <body>
              <div id="app">
                <ErrorBoundary fallback={ServerErrorFallback}>
                  <Suspense fallback={<Loading />}>{children}</Suspense>
                </ErrorBoundary>
              </div>
              {scripts}
            </body>
          </html>
        )
      }}
    />
  )
})
