// @refresh reload
import { StartServer, createHandler } from '@solidjs/start/server'
import { ErrorBoundary, Suspense } from 'solid-js'
import { Loading } from './components/_shared/Loading'
import { useLocalize } from './context/localize'

// biome-ignore lint/suspicious/noExplicitAny: ok
const ServerErrorFallback = (err: any) => {
  console.error('[Server] Error during SSR:', err)
  console.error('[Server] Stack trace:', err?.stack)

  // В production возвращаем минимальный HTML
  if (process.env.NODE_ENV === 'production') {
    return (
      <div style={{ padding: '20px', 'text-align': 'center' }}>
        <h1>Загрузка...</h1>
        <p>Пожалуйста, подождите</p>
      </div>
    )
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
  const { t } = useLocalize()

  return (
    <StartServer
      document={({ assets, children, scripts }) => {
        
        return (
          <html lang="ru">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>{t('Discours')}</title>
              
              {/* ============ ОБЯЗАТЕЛЬНЫЕ OPEN GRAPH ТЕГИ ============ */}
              <meta property="og:type" content="website" />
              <meta property="og:title" content={t('Discours')} />
              <meta property="og:description" content={t('Discours – an open magazine about culture, science and society')} />
              <meta property="og:image" content="https://files.dscrs.site/production/image/logo_image.png" />
              <meta property="og:url" content="https://discours.io" />
              <meta property="og:logo" content="https://files.dscrs.site/logo_sign.png" />
              <meta property="og:site_name" content={t('Discours')} />
              <meta property="og:locale" content="ru" />
              
              {/* ============ ДОПОЛНИТЕЛЬНЫЕ OG ТЕГИ ============ */}
              <meta property="og:image:width" content="1200" />
              <meta property="og:image:height" content="630" />
              <meta property="og:image:alt" content={t('Discours – an open magazine about culture, science and society')} />
              <meta property="og:image:type" content="image/png" />
              
              {/* ============ БАЗОВЫЕ МЕТАТЕГИ ============ */}
              <meta name="keywords" content={t('keywords')} />
              <meta name="description" content={t('Discours – an open magazine about culture, science and society')} />
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
