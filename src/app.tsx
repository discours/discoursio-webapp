import { MetaProvider } from '@solidjs/meta'
import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { Component, type JSX, Suspense } from 'solid-js'

import { AuthToken } from '@authorizerdev/authorizer-js'
import { Loading } from './components/_shared/Loading'
import { AuthorsProvider } from './context/authors'
import { EditorProvider } from './context/editor'
import { FeaturedFeedProvider } from './context/featured'
import { FeedProvider } from './context/feed'
import { FollowingProvider } from './context/following'
import { LocalizeProvider } from './context/localize'
import { SessionProvider } from './context/session'
import { TopicsProvider } from './context/topics'
import { UIProvider } from './context/ui'

import '~/styles/app.scss'

export const Providers: Component<{ children?: JSX.Element }> = (props) => {
  const sessionStateChanged = (payload: AuthToken) => {
    console.log('[app] Session state changed:', payload)
  }

  return (
    <LocalizeProvider>
      <SessionProvider onStateChangeCallback={sessionStateChanged}>
        <UIProvider>
          <TopicsProvider>
            <AuthorsProvider>
              <FeedProvider>
                <EditorProvider>
                  <FeaturedFeedProvider>
                    <FollowingProvider>
                      <MetaProvider>
                        <Suspense fallback={<Loading />}>{props.children}</Suspense>
                      </MetaProvider>
                    </FollowingProvider>
                  </FeaturedFeedProvider>
                </EditorProvider>
              </FeedProvider>
            </AuthorsProvider>
          </TopicsProvider>
        </UIProvider>
      </SessionProvider>
    </LocalizeProvider>
  )
}

export const App = () => (
  <Router root={Providers}>
    <FileRoutes />
  </Router>
)

export default App
