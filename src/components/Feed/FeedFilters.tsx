import { createEffect, createSignal, on, createMemo, onMount } from 'solid-js'
import { EXPO_LAYOUTS, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { getFromDate } from '~/lib/fromPeriod'
import { PeriodType } from '~/lib/fromPeriod'
import { ExpoLayoutType } from '~/types/common'
import { capitalize } from '~/utils/capitalize'
import { DropDown, OptionGroup } from '../_shared/DropDown/DropDown'
import type { Option } from '../_shared/DropDown/DropDown'

import styles from '~/styles/views/Feed.module.scss'

export type FeedMode = 'featured' | 'unfeatured' | 'all'

export type ShoutsOrder = 'recent' | 'top' | 'hot'
export const periodToAfter = (period: PeriodType): number => {
  const now = Math.floor(Date.now() / 1000)
  return now - getFromDate(period)
}

export const FeedFilters = () => {
  const { t } = useLocalize()
  const { updateFeedOptions, feedOptions } = useFeed()

  const [currentPeriod, setCurrentPeriod] = createSignal<PeriodType>(PeriodType.AllTime)
  const [currentFeedMode, setCurrentFeedMode] = createSignal<FeedMode>('all')

  // Синхронизируем только при инициализации
  onMount(() => {
    const mode = feedOptions()?.mode
    if (mode) {
      setCurrentFeedMode(mode as FeedMode)
    }
  }) // Высокий приоритет для выполнения при инициализации

  function getPeriodTitle(period: PeriodType): string {
    const title = {
      [PeriodType.AllTime]: 'All time',
      [PeriodType.Day]: 'Day',
      [PeriodType.Week]: 'Week',
      [PeriodType.Month]: 'Month',
      [PeriodType.Year]: 'Year'
    }[period] || 'All time'
    return t(title)
  }

  createEffect(on(() =>feedOptions()?.filters?.after, (after) => {
    if (!after) {
      setCurrentPeriod(PeriodType.AllTime)
      return
    }
    // Находим ближайший период
    const now = Math.floor(Date.now() / 1000)
    const diff = now - after
    
    const periods = Object.values(PeriodType)
    const period = periods.find(p => {
      const periodDiff = now - getFromDate(p)
      return Math.abs(diff - periodDiff) < 24 * 60 * 60 // допуск в 1 день
    })
    
    setCurrentPeriod(period || PeriodType.AllTime)
  }))

  const asOptionsGroup = (
    opts: string[],
    title?: string,
    onChange?: (option: Option) => void
  ): OptionGroup => {
    const options = opts.map((o) => ({
      value: o,
      title: title === '' ? (
        Object.values(PeriodType).includes(o as PeriodType) 
          ? getPeriodTitle(o as PeriodType) 
          : t(capitalize(o))
      ) : t(capitalize(o))
    }))
    
    if (title) {
      const currentLayouts = feedOptions()?.filters?.layouts || []
      return {
        title,
        options,
        selected: options
          .map((opt, index) => (currentLayouts.includes(opt.value as string) ? index : -1))
          .filter((index) => index !== -1),
        onChange
      }
    }

    return {
      title,
      options,
      selected: [options.findIndex(opt => {
        const isSelected = Object.values(PeriodType).includes(opt.value as PeriodType)
          ? opt.value === currentPeriod()
          : opt.value === currentFeedMode()
        // console.log('Option:', opt.value, 'Selected:', isSelected, 'CurrentFeedMode:', currentFeedMode())
        return isSelected
      })],
      onChange
    }
  }

  const layoutsOptionsGroupHandler = (opt: Option) => {
    if (!opt?.value) return

    const currentLayouts = feedOptions()?.filters?.layouts || []
    const newLayouts = currentLayouts.includes(opt.value as ExpoLayoutType | 'article')
      ? currentLayouts.filter((x) => x !== opt.value)
      : [...currentLayouts, opt.value as ExpoLayoutType | 'article']

    updateFeedOptions({
      filters: {
        ...feedOptions()?.filters,
        ...(newLayouts.length ? { layouts: newLayouts } : {})
      }
    })
  }

  const featuredFilterHandler = (opt: Option) => {
    if (!opt?.value) return
    const mode = opt.value as FeedMode
    setCurrentFeedMode(mode)
    updateFeedOptions({ mode })
    console.log('updated mode', mode)
  }

  const periodOptionsGroupHandler = (opt: Option) => {
    const period = opt?.value as PeriodType
    if (!period) return
    const after = getFromDate(period)
    if (period === PeriodType.AllTime) {
      const filters = feedOptions()?.filters
      delete filters?.after
      updateFeedOptions({ filters })
    } else {
        updateFeedOptions({
          filters: {
          ...feedOptions()?.filters,
          ...(after ? { after } : {})
        }
      })
    }
    console.log('period', period)
    setCurrentPeriod(period)
  }

  const periodOptionsGroup = createMemo(() => 
    asOptionsGroup(
      Object.values(PeriodType),
      '',
      periodOptionsGroupHandler
    )
  )
  return (
    <div class={styles.dropdowns}>
      <DropDown
        popupProps={{ horizontalAnchor: 'right' }}
        options={[
          asOptionsGroup(
            ['all', 'featured', 'unfeatured'],
            '',
            featuredFilterHandler
          ),
          asOptionsGroup(
            ['article', ...EXPO_LAYOUTS],
            t('Layouts'),
            layoutsOptionsGroupHandler
          )
        ]}
        triggerCssClass={styles.periodSwitcher}
      />
      <DropDown
        popupProps={{ horizontalAnchor: 'right' }}
        options={[periodOptionsGroup()]}
        triggerCssClass={styles.periodSwitcher}
      />
    </div>
  )
}

