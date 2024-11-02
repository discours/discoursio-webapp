import { Meta, MetaProvider } from '@solidjs/meta'
import { Router } from '@solidjs/router'
import { FileRoutes } from '@solidjs/start/router'
import { type JSX, Suspense } from 'solid-js'

import { AuthToken } from '@authorizerdev/authorizer-js'
import { Loading } from './components/_shared/Loading'
import { AuthorsProvider } from './context/authors'
import { EditorProvider } from './context/editor'
import { FeedProvider } from './context/feed'
import { LocalizeProvider } from './context/localize'
import { SessionProvider } from './context/session'
import { TopicsProvider } from './context/topics'
import { UIProvider } from './context/ui'

import '~/styles/app.scss'
import { FollowingProvider } from './context/following'

export const Providers = (props: { children?: JSX.Element }) => {
  const sessionStateChanged = (payload: AuthToken) => {
    console.debug(payload)
    // TODO: maybe load subs here
  }
  return (
    <LocalizeProvider>
      <SessionProvider onStateChangeCallback={sessionStateChanged}>
        <TopicsProvider>
          <FeedProvider>
            <MetaProvider>
              <Meta name="viewport" content="width=device-width, initial-scale=1" />
              <UIProvider>
                <EditorProvider>
                  <AuthorsProvider>
                    <FollowingProvider>
                      <Suspense fallback={<Loading />}>{props.children}</Suspense>
                    </FollowingProvider>
                  </AuthorsProvider>
                </EditorProvider>
              </UIProvider>
            </MetaProvider>
          </FeedProvider>
        </TopicsProvider>
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
