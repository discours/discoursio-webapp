import { MetaProvider } from '@solidjs/meta'
import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import {
  Component,
  ErrorBoundary,
  type JSX,
  Suspense,
  createEffect,
  createSignal,
  on,
  onMount
} from 'solid-js'

import { sessionStateChanged } from '~/context/session'
import { Loading } from './components/_shared/Loading'
import { OfflineStatus } from './components/_shared/OfflineStatus'
import { AuthorsProvider } from './context/authors'
import { ConnectProvider } from './context/connect'
import { DraftsProvider } from './context/drafts'
import { FeaturedFeedProvider } from './context/featured'
import { FeedProvider } from './context/feed'
import { FollowingProvider } from './context/following'
import { LocalizeProvider } from './context/localize'
import { SessionProvider } from './context/session'
import { TopicsProvider } from './context/topics'
import { UIProvider } from './context/ui'

import '~/styles/app.scss'
import '~/styles/toast.scss'

// biome-ignore lint/suspicious/noExplicitAny: ok
const ErrorFallback: Component<{ error: any; reset: () => void }> = (props) => {
  onMount(() => {
    console.error('[App] ErrorBoundary caught error:', props.error)
  })

  return (
    <div style={{ padding: '20px', 'text-align': 'center' }}>
      <h1>Что-то пошло не так</h1>
      <details style={{ 'white-space': 'pre-wrap', 'text-align': 'left' }}>
        <summary>Детали ошибки</summary>
        {props.error?.toString()}
      </details>
      <button onClick={props.reset} style={{ margin: '10px', padding: '10px 20px' }}>
        Попробовать снова
      </button>
    </div>
  )
}

export const Providers: Component<{ children?: JSX.Element }> = (props) => {
  const [hasError, setHasError] = createSignal(false)

  onMount(() => {
    console.log('[App] Providers mounted')

    // Глобальный обработчик неперехваченных ошибок
    window.addEventListener('error', (event) => {
      console.error('[App] Global error:', event.error)
      setHasError(true)
    })

    window.addEventListener('unhandledrejection', (event) => {
      console.error('[App] Unhandled rejection:', event.reason)
      setHasError(true)
    })
  })

  createEffect(
    on(
      hasError,
      (hasError: boolean) => {
        if (hasError) {
          console.error('[App] ErrorBoundary caught error:', hasError)
        }
      },
      { defer: true }
    )
  )

  return (
    <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}>
      <LocalizeProvider>
        <OfflineStatus />
        <SessionProvider onStateChangeCallback={sessionStateChanged}>
          <ConnectProvider>
            <UIProvider>
              <TopicsProvider>
                <AuthorsProvider>
                  <FeedProvider>
                    <DraftsProvider>
                      <FeaturedFeedProvider>
                        <FollowingProvider>
                          <MetaProvider>
                            <Suspense fallback={<Loading />}>{props.children}</Suspense>
                          </MetaProvider>
                        </FollowingProvider>
                      </FeaturedFeedProvider>
                    </DraftsProvider>
                  </FeedProvider>
                </AuthorsProvider>
              </TopicsProvider>
            </UIProvider>
          </ConnectProvider>
        </SessionProvider>
      </LocalizeProvider>
    </ErrorBoundary>
  )
}

export const App = () => {
  onMount(() => {
    console.log('[App] App component mounted')
  })

  return (
    <Router root={Providers}>
      <FileRoutes />
    </Router>
  )
}

export default App
