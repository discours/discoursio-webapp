/**
 * 🔄 Topic redirect route
 * Redirects /topic/social to /topic/social/shouts for proper SSR handling
 */

import type { RouteDefinition } from '@solidjs/router'
import { redirect } from '@solidjs/router'

export const route: RouteDefinition = {
  load: ({ params }) => {
    // Redirect to default mode (shouts) for proper SSR loading
    console.log(`[TopicRedirect] Redirecting /topic/${params.slug} to /topic/${params.slug}/shouts`)
    throw redirect(`/topic/${params.slug}/shouts`)
  }
}

export default function TopicRedirect() {
  // This component won't render because of the redirect
  return null
}
