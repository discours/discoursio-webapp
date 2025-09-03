// @refresh reload
import { createHandler, StartServer } from '@solidjs/start/server'
import { ErrorBoundary, Suspense } from 'solid-js'
import { Loading } from './components/_shared/Loading'
import { cdnUrl } from './config'
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
  const { t, lang } = useLocalize()

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

              {/* ========== БАЗОВЫЕ МЕТАТЕГИ ============ */}
              <title>{t('Discours')}</title>
              <meta name="description" content={t('Discours – an open magazine about culture, science and society')} />
              <meta name="keywords" content={t('keywords')} />

              {/* ========== OPEN GRAPH ТЕГИ ============ */}
              <meta property="og:type" content="website" />
              <meta property="og:title" content={t('Discours')} />
              <meta
                property="og:description"
                content={t('Discours – an open magazine about culture, science and society')}
              />
              <meta property="og:image" content={`${cdnUrl}/production/image/logo_image.png`} />
              <meta property="og:url" content="https://discours.io" />
              <meta property="og:logo" content={`${cdnUrl}/logo_sign.png`} />
              <meta property="og:site_name" content={t('Discours')} />
              <meta property="og:locale" content={currentLang} />
              <meta property="og:image:width" content="1200" />
              <meta property="og:image:height" content="630" />
              <meta property="og:image:type" content="image/png" />
              <meta property="og:image:secure_url" content={`${cdnUrl}/production/image/logo_image.png`} />
              <meta property="og:image:alt" content={t('Discours')} />

              {/* ========== TWITTER CARD ТЕГИ ============ */}
              <meta name="twitter:card" content="summary_large_image" />
              <meta name="twitter:site" content="@discoursio" />
              <meta name="twitter:creator" content="@discoursio" />
              <meta name="twitter:title" content={t('Discours')} />
              <meta
                name="twitter:description"
                content={t('Discours – an open magazine about culture, science and society')}
              />
              <meta name="twitter:image" content={`${cdnUrl}/production/image/logo_image.png`} />
              <meta name="twitter:image:alt" content={t('Discours')} />

              {/* ========== ДОПОЛНИТЕЛЬНЫЕ МЕТАТЕГИ ============ */}
              <link rel="canonical" href="https://discours.io" />
              <meta name="robots" content="index, follow" />
              <meta name="author" content={t('Discours')} />
              <meta name="theme-color" content="#000000" />

              {/* VK и другие соцсети */}
              <meta name="vk:title" content={t('Discours')} />
              <meta
                name="vk:description"
                content={t('Discours – an open magazine about culture, science and society')}
              />
              <meta name="vk:image" content={`${cdnUrl}/production/image/logo_image.png`} />

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
