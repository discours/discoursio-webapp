import clsx from 'clsx'
import { Show, createMemo, createSignal, onMount } from 'solid-js'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon/Icon'
import { EXPO_LAYOUTS, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { getTimestampFromPeriod } from '~/lib/fromPeriod'
import { PeriodType } from '~/lib/fromPeriod'
import { ExpoLayoutType } from '~/types/common'
import { FeaturedFilter, FeedFilters } from '~/types/filters'
import { capitalize } from '~/utils/capitalize'
import { DropDown, OptionGroup } from '../_shared/DropDown/DropDown'
import type { Option } from '../_shared/DropDown/DropDown'

import { TFunction } from 'i18next'
import styles from '~/styles/views/Feed.module.scss'

type FeedFiltersControlProps = {
  type?: string
  mode?: string
}

function getPeriodTitle(period: PeriodType, t: TFunction): string {
  return (
    {
      [PeriodType.AllTime]: t('All time'),
      [PeriodType.Day]: t('Day'),
      [PeriodType.Week]: t('Week'),
      [PeriodType.Month]: t('Month'),
      [PeriodType.Year]: t('Year')
    }[period] || t('All time')
  )
}
export const FeedFiltersControl = (_props: FeedFiltersControlProps) => {
  const { t } = useLocalize()
  const { filterState, updateFilters, loadRecentFeed, loadHotFeed, loadTopFeed, mode } = useFeed()

  const [currentPeriod, setCurrentPeriod] = createSignal<PeriodType>(PeriodType.AllTime)
  const [currentFeaturedFilter, setCurrentFeaturedFilter] = createSignal<FeaturedFilter>('all')
  const [currentLayouts, setCurrentLayouts] = createSignal<(ExpoLayoutType | 'article')[]>([])
  const [hasChanges, setHasChanges] = createSignal(false)

  // Функция для перезагрузки фида
  const reloadFeed = () => {
    const opts = {
      filters: {
        after: currentPeriod() ? getTimestampFromPeriod(currentPeriod()) : undefined,
        featured:
          currentFeaturedFilter() === 'featured'
            ? true
            : currentFeaturedFilter() === 'unfeatured'
              ? false
              : undefined,
        layouts: currentLayouts()
      }
    }
    switch (mode()) {
      case 'hot':
        loadHotFeed(opts)
        break
      case 'top':
        loadTopFeed(opts)
        break
      default:
        loadRecentFeed(opts)
    }
    setHasChanges(false)
  }

  // Синхронизируем начальные фильтры
  onMount(() => {
    const filters = filterState()?.filters as FeedFilters

    // Синхронизация featured фильтра
    if (filters.featured !== undefined) {
      setCurrentFeaturedFilter(
        filters.featured === true ? 'featured' : filters.featured === false ? 'unfeatured' : 'all'
      )
    }

    // Синхронизация периода
    if (filters.after !== undefined) {
      const period = Object.values(PeriodType).find((p) => getTimestampFromPeriod(p) === filters.after)
      if (period) setCurrentPeriod(period)
    }

    // Синхронизация layouts
    if (filters.layouts?.length) {
      setCurrentLayouts(filters.layouts as (ExpoLayoutType | 'article')[])
    }
  })

  // Обработчик фильтра featured
  const featuredFilterHandler = (opt: Option) => {
    if (!opt?.value) return
    const mode = opt.value as FeaturedFilter
    setCurrentFeaturedFilter(mode)

    updateFilters({
      featured: mode === 'featured' ? true : mode === 'unfeatured' ? false : undefined
    })
    setHasChanges(true)
  }

  // Улучшенный обработчик layouts с поддержкой множественного выбора
  const layoutsOptionsGroupHandler = (opt: Option) => {
    if (!opt?.value) return

    const layouts = currentLayouts()
    const newLayouts = layouts.includes(opt.value as ExpoLayoutType | 'article')
      ? layouts.filter((x) => x !== opt.value)
      : [...layouts, opt.value as ExpoLayoutType | 'article']

    setCurrentLayouts(newLayouts)
    updateFilters({
      layouts: newLayouts.length ? newLayouts : undefined
    })
    setHasChanges(true)
  }

  // Обработчик периода
  const periodHandler = (opt: Option) => {
    if (!opt?.value) return
    const period = opt.value as PeriodType
    setCurrentPeriod(period || PeriodType.AllTime)
    updateFilters({
      after: period === PeriodType.AllTime ? undefined : getTimestampFromPeriod(period)
    })
    setHasChanges(true)
  }

  // Мемоизируем создание опций с учетом типа OptionGroup
  const createOptionsGroup = createMemo(() => {
    const featuredOptions = ['all', 'featured', 'unfeatured'].map((o) => ({
      value: o,
      title: t(capitalize(o))
    })) satisfies Option[]

    const layoutOptions = ['article', ...EXPO_LAYOUTS].map((o) => ({
      value: o,
      title: t(capitalize(o))
    })) satisfies Option[]

    const periodOptions = Object.values(PeriodType).map((o) => ({
      value: o,
      title: getPeriodTitle(o, t)
    })) satisfies Option[]

    return {
      featured: featuredOptions,
      layouts: layoutOptions,
      periods: periodOptions
    }
  })

  // Типизируем возвращаемые группы
  const getDropdownGroups = (): OptionGroup[] => {
    const options = createOptionsGroup()

    return [
      {
        options: options.featured,
        selected: [options.featured.findIndex((o) => o.value === currentFeaturedFilter())],
        onChange: featuredFilterHandler
      },
      {
        title: t('Layouts'),
        options: options.layouts,
        selected: currentLayouts()
          .map((l) => options.layouts.findIndex((o) => o.value === l))
          .filter((i) => i !== -1), // Фильтруем невалидные индексы
        multiple: true,
        onChange: layoutsOptionsGroupHandler
      }
    ]
  }

  const getPeriodGroup = (): OptionGroup[] => {
    const options = createOptionsGroup()
    return [
      {
        options: options.periods,
        selected: [options.periods.findIndex((o) => o.value === currentPeriod())],
        onChange: periodHandler
      }
    ]
  }

  return (
    <div class={styles.filtersContainer}>
      <div class={styles.dropdowns}>
        <DropDown
          popupProps={{ horizontalAnchor: 'right' }}
          options={getDropdownGroups()}
          triggerCssClass={clsx(styles.periodSwitcher, {
            [styles.active]: currentLayouts().length > 0
          })}
        />
        <DropDown
          popupProps={{ horizontalAnchor: 'right' }}
          options={getPeriodGroup()}
          triggerCssClass={clsx(styles.periodSwitcher, {
            [styles.active]: currentPeriod() && currentPeriod() !== PeriodType.AllTime
          })}
        />
        <Show when={hasChanges()}>
          <Button
            variant="secondary"
            class={styles.reloadButton}
            onClick={reloadFeed}
            title={t('Apply filters')}
            value={<Icon name="check-subscribed-black" />}
          />
        </Show>
      </div>
    </div>
  )
}

export default FeedFiltersControl
