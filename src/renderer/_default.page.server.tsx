import type { PageContext } from './types'
import type { Language } from '../context/localize'

import i18next from 'i18next'
import ICU from 'i18next-icu'
import { generateHydrationScript, getAssets, renderToString } from 'solid-js/web'
import { escapeInject, dangerouslySkipEscape } from 'vike/server'

import en from '../../public/locales/en/translation.json'
import ru from '../../public/locales/ru/translation.json'
import { App } from '../components/App'
import { initRouter } from '../stores/router'

export const passToClient = ['pageProps', 'lng', 'documentProps', 'is404']

const getLng = (pageContext: PageContext): Language => {
  const { urlParsed, cookies } = pageContext

  if (urlParsed.search.lng) {
    return urlParsed.search.lng === 'en' ? 'en' : 'ru'
  }

  if (cookies?.lng === 'en') {
    return 'en'
  }

  return 'ru'
}

export const render = async (pageContext: PageContext) => {
  const lng = getLng(pageContext)

  if (!i18next.isInitialized) {
    // eslint-disable-next-line import/no-named-as-default-member
    await i18next.use(ICU).init({
      // debug: true,
      supportedLngs: ['ru', 'en'],
      fallbackLng: lng,
      initImmediate: false,
      lng,
      resources: {
        ru: { translation: ru },
        en: { translation: en },
      },
    })
  } else if (i18next.language !== lng) {
    // eslint-disable-next-line import/no-named-as-default-member
    await i18next.changeLanguage(lng)
  }

  initRouter(pageContext.urlParsed.pathname, pageContext.urlParsed.search)

  pageContext.lng = lng

  const rootContent = renderToString(() => <App {...pageContext.pageProps} is404={pageContext.is404} />)

  return escapeInject`<!DOCTYPE html>
    <html lang="${lng}">
      <head>
        <meta name="robots" content="noindex,nofollow">
        ${dangerouslySkipEscape(getAssets())}
      </head>
      <body>
        <div id="root">${dangerouslySkipEscape(rootContent)}</div>
        ${dangerouslySkipEscape(generateHydrationScript())}
      </body>
    </html>`
}
