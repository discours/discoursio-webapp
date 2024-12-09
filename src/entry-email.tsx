import { StartServer, createHandler } from '@solidjs/start/server'
import type { PageEvent } from '@solidjs/start/server'
import { EMAIL_TEMPLATES, type TemplateKey, getMailgunTemplate } from './emails/templates'

export default createHandler(async (context: PageEvent) => {
  const url = new URL(context.request.url)
  const path = url.pathname.split('/emails/').pop()
  const template = getMailgunTemplate(path)

  if (!template) {
    throw new Error(`Template ${path} not found`)
  }

  const Component = EMAIL_TEMPLATES[template]

  return (
    <StartServer document={() => <Component />} />
  )
})
