import { MetaProvider } from '@solidjs/meta'
import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { Component, createEffect, createSignal, ErrorBoundary, type JSX, on, onMount, Suspense } from 'solid-js'

import { sessionStateChanged } from '~/context/session'
import { Loading } from './components/_shared/Loading'
import { NotificationsPanelPortal } from './components/_shared/NotificationsPanelPortal'
import { OfflineStatus } from './components/_shared/OfflineStatus'
import { AuthorsProvider } from './context/authors'
import { ConnectProvider } from './context/connect'
import { DraftsProvider } from './context/drafts'
import { FeaturedFeedProvider } from './context/featured'
import { FeedProvider } from './context/feed'
import { FollowingProvider } from './context/following'
import { LocalDraftsProvider } from './context/localDrafts'
import { LocalizeProvider } from './context/localize'
import { NotificationsProvider } from './context/notifications'
import { SessionProvider } from './context/session'
import { TopicsProvider } from './context/topics'
import { UIProvider } from './context/ui'
import { UploadProvider } from './context/upload'

import '~/styles/app.scss'
import '~/styles/toast.scss'

// biome-ignore lint/suspicious/noExplicitAny: ok
const ErrorFallback: Component<{ error: any; reset: () => void }> = (props) => {
  onMount(() => {
    // Расширенное логирование ошибок с контекстом
    const errorInfo = {
      error: props.error,
      message: props.error?.message || 'Unknown error',
      stack: props.error?.stack,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
      // Информация о состоянии DOM
      domInfo:
        typeof window !== 'undefined'
          ? {
              documentReadyState: document.readyState,
              bodyChildrenCount: document.body?.children?.length || 0,
              hasDataHydrationMarkers: !!document.querySelector('[data-hk]')
            }
          : null
    }

    console.group('🚨 [App] ErrorBoundary caught error')
    console.error('Error object:', props.error)
    console.error('Full context:', errorInfo)

    // Специальная обработка DOM ошибок
    if (props.error?.message?.includes('insertBefore') || props.error?.message?.includes('Node')) {
      console.error('🔍 DOM Error detected - potential hydration mismatch:')
      console.error('- This usually indicates SSR/Client state mismatch')
      console.error('- Check for async state changes that affect initial render')
      console.error('- Verify that components render consistently on server and client')
    }

    if (props.error?.message?.includes('hydration') || props.error?.message?.includes('Hydration')) {
      console.error('💧 Hydration Error detected:')
      console.error('- Server and client rendered different content')
      console.error('- Check for browser-only APIs used during SSR')
      console.error("- Verify async data loading doesn't change initial state")
    }

    console.groupEnd()

    // Отправка ошибки в систему мониторинга (если настроена)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: props.error?.message || 'Unknown error',
        fatal: true
      })
    }
  })

  return (
    <div style={{ padding: '20px', 'text-align': 'center' }}>
      <h1>Что-то пошло не так</h1>
      <details style={{ 'white-space': 'pre-wrap', 'text-align': 'left' }}>
        <summary>Детали ошибки</summary>
        <strong>Сообщение:</strong> {props.error?.message || 'Unknown error'}
        <br />
        <br />
        <strong>Тип:</strong> {props.error?.name || 'Error'}
        <br />
        <br />
        {props.error?.stack && (
          <>
            <strong>Stack trace:</strong>
            <br />
            {props.error.stack}
          </>
        )}
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

    // Расширенный глобальный обработчик неперехваченных ошибок
    window.addEventListener('error', (event) => {
      const errorContext = {
        message: event.error?.message || event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        // DOM context
        documentReadyState: document.readyState,
        hasHydrationMarkers: !!document.querySelector('[data-hk]'),
        activeElement: document.activeElement?.tagName
      }

      console.group('🚨 [App] Global uncaught error')
      console.error('Event:', event)
      console.error('Error object:', event.error)
      console.error('Context:', errorContext)

      // Специальная обработка известных ошибок
      if (event.error?.message?.includes('insertBefore')) {
        console.error('🔍 insertBefore error - likely DOM manipulation issue:')
        console.error('- Check for components trying to insert nodes in wrong parent')
        console.error('- Verify Show/For components have stable conditions')
        console.error('- Look for race conditions in async state updates')
      }

      if (event.error?.message?.includes('Cannot read properties of null')) {
        console.error('🔍 Null reference error:')
        console.error('- Check for missing null checks in reactive computations')
        console.error('- Verify component cleanup in createEffect')
      }

      console.groupEnd()
      setHasError(true)
    })

    window.addEventListener('unhandledrejection', (event) => {
      const rejectionContext = {
        reason: event.reason,
        promise: event.promise,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }

      console.group('🚨 [App] Unhandled promise rejection')
      console.error('Event:', event)
      console.error('Reason:', event.reason)
      console.error('Context:', rejectionContext)
      console.groupEnd()

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
          <UploadProvider>
            <ConnectProvider>
              <NotificationsProvider>
                <UIProvider>
                  <TopicsProvider>
                    <AuthorsProvider>
                      <FeedProvider>
                        <LocalDraftsProvider>
                          <DraftsProvider>
                            <FeaturedFeedProvider>
                              <FollowingProvider>
                                <MetaProvider>
                                  <Suspense fallback={<Loading />}>{props.children}</Suspense>
                                  <NotificationsPanelPortal />
                                </MetaProvider>
                              </FollowingProvider>
                            </FeaturedFeedProvider>
                          </DraftsProvider>
                        </LocalDraftsProvider>
                      </FeedProvider>
                    </AuthorsProvider>
                  </TopicsProvider>
                </UIProvider>
              </NotificationsProvider>
            </ConnectProvider>
          </UploadProvider>
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
