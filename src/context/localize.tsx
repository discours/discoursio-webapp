import { useSearchParams } from '@solidjs/router'
import type { Accessor, JSX } from 'solid-js'
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  on,
  onMount,
  Show,
  useContext
} from 'solid-js'
import { type i18n, i18next, i18nextInit, TimeAgo } from '~/intl/i18next'

i18nextInit()

const SPEC_REGEX = /\s*г\./

/**
 * Преобразует timestamp в объект Date с проверкой формата
 * @param timestamp - Временная метка (в секундах или миллисекундах)
 * @returns Объект Date или null при ошибке
 */
export const createValidDate = (timestamp: number | string | undefined | null): Date | null => {
  if (timestamp === undefined || timestamp === null) return null

  // Преобразуем в число, если передана строка
  const numericTimestamp = typeof timestamp === 'string' ? Number(timestamp) : timestamp

  if (Number.isNaN(numericTimestamp)) return null

  let date: Date

  // Если timestamp в секундах (10 цифр), конвертируем в миллисекунды
  if (String(numericTimestamp).length <= 10) {
    date = new Date(numericTimestamp * 1000)
  } else {
    // Иначе предполагаем, что timestamp уже в миллисекундах
    date = new Date(numericTimestamp)
  }

  // Проверка валидности даты и разумности года
  if (Number.isNaN(date.getTime())) return null

  const year = date.getFullYear()
  if (year < 1900 || year > 2100) {
    console.error('Invalid year in date:', year, date)
    return null
  }

  return date
}

export type LocalizeContextType = {
  t: i18n['t']
  lang: Accessor<Language>
  setLang: (lang: Language) => void
  formatTime: (date: Date, options?: Intl.DateTimeFormatOptions) => string
  formatDate: (
    date: Date | string | number | null | undefined,
    options?: Intl.DateTimeFormatOptions
  ) => string
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

  const formatDate = (
    rawDate: Date | string | number | null | undefined,
    options: Intl.DateTimeFormatOptions = {}
  ) => {
    let validDate =
      rawDate instanceof Date
        ? rawDate
        : createValidDate(rawDate as string | number | null | undefined) || new Date()

    // Дополнительная проверка на адекватность года
    const year = validDate.getFullYear()
    if (year < 1900 || year > 2100) {
      console.error('Invalid year in date:', year, validDate)
      // Если год некорректный, используем текущую дату
      validDate = new Date()
    }

    const opts = Object.assign(
      {},
      {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      },
      options
    )

    return validDate.toLocaleDateString(lang(), opts).replace(SPEC_REGEX, '')
  }

  const timeAgo = createMemo(() => new TimeAgo(lang()))

  const formatTimeAgo = (date: Date) => timeAgo().format(date)

  const value: LocalizeContextType = {
    t: i18next.t as i18n['t'],
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
