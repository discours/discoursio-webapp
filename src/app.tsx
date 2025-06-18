import { MetaProvider } from '@solidjs/meta'
import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { Component, type JSX, Suspense } from 'solid-js'

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

export const Providers: Component<{ children?: JSX.Element }> = (props) => {
  return (
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
  )
}

export const App = () => (
  <Router root={Providers}>
    <FileRoutes />
  </Router>
)

export default App
