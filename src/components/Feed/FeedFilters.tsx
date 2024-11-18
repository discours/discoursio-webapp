import { createEffect, createSignal, on, onMount } from 'solid-js'
import { EXPO_LAYOUTS, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { getFromDate } from '~/lib/fromPeriod'
import { PeriodType } from '~/lib/fromPeriod'
import { ExpoLayoutType } from '~/types/common'
import { capitalize } from '~/utils/capitalize'
import { DropDown, OptionGroup } from '../_shared/DropDown/DropDown'
import type { Option } from '../_shared/DropDown/DropDown'

import { InputMaybe } from '~/graphql/schema/core.gen'
import styles from '~/styles/views/Feed.module.scss'

export type FeaturedFilter = 'featured' | 'unfeatured' | 'all'

export const periodToAfter = (period: PeriodType): number => {
  const now = Math.floor(Date.now() / 1000)
  return now - getFromDate(period)
}

function getPeriodTitle(period: PeriodType): string {
  return (
    {
      [PeriodType.AllTime]: 'All time',
      [PeriodType.Day]: 'Day',
      [PeriodType.Week]: 'Week',
      [PeriodType.Month]: 'Month',
      [PeriodType.Year]: 'Year'
    }[period] || 'All time'
  )
}

export const FeedFilters = () => {
  const { t } = useLocalize()
  const { updateOptions, options: feedOptions } = useFeed()

  const [currentPeriod, setCurrentPeriod] = createSignal<PeriodType>(PeriodType.AllTime)
  const [currentFeaturedFilter, setCurrentFeaturedFilter] = createSignal<FeaturedFilter>('all')

  // Синхронизируем фильтр featured при инициализации
  onMount(() => {
    const featured = feedOptions()?.filters?.featured
    if (featured !== undefined) {
      setCurrentFeaturedFilter(featured === true ? 'featured' : featured === false ? 'unfeatured' : 'all')
    }
  })

  // Синхронизируем период при изменении after в опциях
  createEffect(
    on(
      () => feedOptions()?.filters?.after,
      (after) => {
        if (!after) {
          setCurrentPeriod(PeriodType.AllTime)
          return
        }

        const now = Date.now()
        const diff = now - after
        const periods = Object.values(PeriodType)

        const period = periods.find((p) => {
          const periodDiff = now - getFromDate(p)
          return Math.abs(diff - periodDiff) < 24 * 60 * 60 // допуск в 1 день
        })

        setCurrentPeriod(period || PeriodType.AllTime)
      }
    )
  )

  // Обработчик фильтра featured
  const featuredFilterHandler = (opt: Option) => {
    if (!opt?.value) return
    const mode = opt.value as FeaturedFilter
    setCurrentFeaturedFilter(mode)

    // Обновляем фильтры в соответствии с выбранным режимом
    updateOptions({
      filters: {
        ...feedOptions()?.filters,
        featured: mode === 'featured' ? true : mode === 'unfeatured' ? false : undefined
      }
    })
  }

  // Обработчик layouts
  const layoutsOptionsGroupHandler = (opt: Option) => {
    if (!opt?.value) return

    const currentLayouts = feedOptions()?.filters?.layouts || []
    const newLayouts = currentLayouts.includes(opt.value as ExpoLayoutType | 'article')
      ? currentLayouts.filter((x: InputMaybe<string>) => x !== opt.value)
      : [...currentLayouts, opt.value as ExpoLayoutType | 'article']

    updateOptions({
      filters: {
        ...feedOptions()?.filters,
        ...(newLayouts.length ? { layouts: newLayouts } : {})
      }
    })
  }

  // Обработчик периода
  const periodHandler = (opt: Option) => {
    if (!opt?.value) return
    const period = opt.value as PeriodType
    if (period === PeriodType.AllTime) {
      const filters = { ...feedOptions()?.filters }
      // biome-ignore lint/performance/noDelete: fine
      delete filters.after
      updateOptions({ filters })
    } else {
      updateOptions({
        filters: {
          ...feedOptions()?.filters,
          after: periodToAfter(period)
        }
      })
    }
  }

  // Создаем группы опций
  const asOptionsGroup = (
    opts: string[],
    title?: string,
    onChange?: (option: Option) => void
  ): OptionGroup => {
    const options = opts.map((o) => ({
      value: o,
      title:
        title === ''
          ? Object.values(PeriodType).includes(o as PeriodType)
            ? getPeriodTitle(o as PeriodType)
            : t(capitalize(o))
          : t(capitalize(o))
    }))

    if (title) {
      const currentLayouts = feedOptions()?.filters?.layouts || []
      const selectedOption = options.find((o) =>
        currentLayouts.includes(o.value as ExpoLayoutType | 'article')
      )
      const selected = [selectedOption ? options.indexOf(selectedOption) : -1]
      return {
        title,
        options,
        selected,
        onChange
      }
    }

    const selectedOption = options.find(
      (o) => o.value === currentFeaturedFilter() || o.value === currentPeriod()
    )
    const selected = [selectedOption ? options.indexOf(selectedOption) : -1]

    return {
      options,
      selected,
      onChange
    }
  }

  return (
    <div class={styles.dropdowns}>
      <DropDown
        popupProps={{ horizontalAnchor: 'right' }}
        options={[
          asOptionsGroup(['all', 'featured', 'unfeatured'], '', featuredFilterHandler),
          asOptionsGroup(['article', ...EXPO_LAYOUTS], t('Layouts'), layoutsOptionsGroupHandler)
        ]}
        triggerCssClass={styles.periodSwitcher}
      />
      <DropDown
        popupProps={{ horizontalAnchor: 'right' }}
        options={[asOptionsGroup(Object.values(PeriodType), '', periodHandler)]}
        triggerCssClass={styles.periodSwitcher}
      />
    </div>
  )
}
