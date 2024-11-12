// @refresh reload
import { StartServer, createHandler } from '@solidjs/start/server'
import { ErrorBoundary, Suspense } from 'solid-js'
import { Loading } from './components/_shared/Loading'

export default createHandler(() => {
  return (
    <StartServer
      document={({ assets, children, scripts }) => (
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="/favicon.ico" />
            {assets}
          </head>
          <body>
            <div id="app">
              <ErrorBoundary
                fallback={(err) => {
                  console.error('Server Error:', err)
                  return <Loading />
                }}
              >
                <Suspense fallback={<Loading />}>{children}</Suspense>
              </ErrorBoundary>
            </div>
            {scripts}
          </body>
        </html>
      )}
    />
  )
})
