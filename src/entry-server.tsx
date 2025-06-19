// @refresh reload
import { StartServer, createHandler } from '@solidjs/start/server'
import { ErrorBoundary, Suspense } from 'solid-js'
import { Loading } from './components/_shared/Loading'

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
  console.log('[Server] createHandler called, NODE_ENV:', process.env.NODE_ENV)
  console.log('[Server] VERCEL env:', process.env.VERCEL)
  console.log(
    '[Server] Available env vars:',
    Object.keys(process.env).filter((k) => k.startsWith('PUBLIC_'))
  )

  return (
    <StartServer
      document={({ assets, children, scripts }) => {
        console.log('[Server] Document render called')
        console.log('[Server] Assets count:', Array.isArray(assets) ? assets.length : 'not array')
        console.log('[Server] Scripts available:', !!scripts)

        return (
          <html lang="ru">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <meta name="description" content="Дискурс - медиа для думающих" />
              <link rel="icon" href="/favicon.ico" />
              <script
                innerHTML={`
                console.log('[Client] Document loaded at:', new Date().toISOString());
                console.log('[Client] Environment:', {
                  NODE_ENV: '${process.env.NODE_ENV}',
                  VERCEL: '${process.env.VERCEL}',
                  url: window.location.href
                });
                
                // Проверяем загрузку React/SolidJS
                console.log('[Client] SolidJS available:', typeof window.solid !== 'undefined');
                
                // Ловим ошибки
                window.addEventListener('error', function(e) {
                  console.error('[Client] Runtime error:', e.error);
                });
                
                window.addEventListener('unhandledrejection', function(e) {
                  console.error('[Client] Unhandled promise rejection:', e.reason);
                });
              `}
              />
              {assets}
            </head>
            <body>
              <div id="app">
                <ErrorBoundary fallback={ServerErrorFallback}>
                  <Suspense fallback={<Loading />}>{children}</Suspense>
                </ErrorBoundary>
              </div>
              <script
                innerHTML={`
                console.log('[Client] Body loaded, app div:', document.getElementById('app'));
                console.log('[Client] App div innerHTML length:', document.getElementById('app')?.innerHTML?.length || 0);
              `}
              />
              {scripts}
            </body>
          </html>
        )
      }}
    />
  )
})
