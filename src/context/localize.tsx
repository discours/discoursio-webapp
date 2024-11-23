import { useSearchParams } from '@solidjs/router'
import type { Accessor, JSX } from 'solid-js'
import {
  Show,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  on,
  onMount,
  useContext
} from 'solid-js'
import { TimeAgo, type i18n, i18next, i18nextInit } from '~/intl/i18next'
import { processPrepositions } from '~/intl/prepositions'

i18nextInit()

export type LocalizeContextType = {
  t: i18n['t']
  lang: Accessor<Language>
  setLang: (lang: Language) => void
  formatTime: (date: Date, options?: Intl.DateTimeFormatOptions) => string
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string
  formatTimeAgo: (date: Date) => string
}

export type Language = 'ru' | 'en'

export const LocalizeContext = createContext<LocalizeContextType>({
  t: (s: string) => s
} as LocalizeContextType)

export function useLocalize() {
  return useContext(LocalizeContext)
}
type LocalizeSearchParams = {
  lng?: Language
}
export const LocalizeProvider = (props: { children: JSX.Element }) => {
  const [lang, setLang] = createSignal<Language>(i18next.language === 'en' ? 'en' : 'ru')
  const [searchParams, changeSearchParams] = useSearchParams<LocalizeSearchParams>()
  // set lang effects
  onMount(() => {
    const lng = searchParams?.lng || localStorage?.getItem('lng') || 'ru'
    setLang(lng as Language)
    changeSearchParams({ lng: undefined })
  })
  createEffect(
    on(lang, (lng: Language) => {
      localStorage?.setItem('lng', lng || 'ru')
      i18next.changeLanguage(lng || 'ru')
    })
  )

  const formatTime = (date: Date, options: Intl.DateTimeFormatOptions = {}) => {
    const opts = Object.assign(
      {},
      {
        hour: '2-digit',
        minute: '2-digit'
      },
      options
    )

    return date.toLocaleTimeString(lang(), opts)
  }

  const formatDate = (date: Date, options: Intl.DateTimeFormatOptions = {}) => {
    const opts = Object.assign(
      {},
      {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      },
      options
    )

    return date.toLocaleDateString(lang(), opts).replace(/\s*г\./, '')
  }

  const timeAgo = createMemo(() => new TimeAgo(lang()))

  const formatTimeAgo = (date: Date) => timeAgo().format(date)

  const value: LocalizeContextType = {
    t: ((...args) => {
      try {
        return i18next.t(...args)
      } catch (_) {
        return args?.length > 0 ? processPrepositions(args[0] as string) : ''
      }
    }) as i18n['t'],
    lang,
    setLang,
    formatTime,
    formatDate,
    formatTimeAgo
  }

  return (
    <LocalizeContext.Provider value={value}>
      <Show when={lang()} keyed={true}>
        {props.children}
      </Show>
    </LocalizeContext.Provider>
  )
}
