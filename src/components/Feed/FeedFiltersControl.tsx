import { createSignal, onMount } from 'solid-js'
import { EXPO_LAYOUTS, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { InputMaybe } from '~/graphql/schema/core.gen'
import { getPeriodTitle, getTimestampFromPeriod } from '~/lib/fromPeriod'
import { PeriodType } from '~/lib/fromPeriod'
import { ExpoLayoutType } from '~/types/common'
import { CommentsFilters, FeaturedFilter, FeedFilters } from '~/types/filters'
import { capitalize } from '~/utils/capitalize'
import { DropDown, OptionGroup } from '../_shared/DropDown/DropDown'
import type { Option } from '../_shared/DropDown/DropDown'

import styles from '~/styles/views/Feed.module.scss'

export const isFeedFilters = (filters: FeedFilters | CommentsFilters): filters is FeedFilters => {
  return 'featured' in filters || 'layouts' in filters || 'after' in filters
}

type FeedFiltersControlProps = {
  type?: string
  mode?: string
}

export const FeedFiltersControl = (_props: FeedFiltersControlProps) => {
  const { t } = useLocalize()
  const { filterState, updateFilters } = useFeed()

  const [currentPeriod, setCurrentPeriod] = createSignal<PeriodType>(PeriodType.AllTime)
  const [currentFeaturedFilter, setCurrentFeaturedFilter] = createSignal<FeaturedFilter>('all')

  // Синхронизируем фильтр featured при инициализации
  onMount(() => {
    const filters = filterState()?.filters as FeedFilters
    const featured = filters.featured
    if (featured !== undefined) {
      setCurrentFeaturedFilter(featured === true ? 'featured' : featured === false ? 'unfeatured' : 'all')
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
  }

  // Обработчик layouts
  const layoutsOptionsGroupHandler = (opt: Option) => {
    if (!opt?.value) return
    if (!isFeedFilters(filterState()?.filters)) return

    const currentLayouts = (filterState()?.filters as FeedFilters).layouts || []
    const newLayouts = currentLayouts.includes(opt.value as ExpoLayoutType | 'article')
      ? currentLayouts.filter((x: InputMaybe<string>) => x !== opt.value)
      : [...currentLayouts, opt.value as ExpoLayoutType | 'article']

    updateFilters({
      layouts: newLayouts.length ? newLayouts : undefined
    })
  }

  // Обработчик периода
  const periodHandler = (opt: Option) => {
    if (!opt?.value) return
    const period = opt.value as PeriodType
    setCurrentPeriod(period || PeriodType.AllTime)
    updateFilters({
      after: period === PeriodType.AllTime ? undefined : getTimestampFromPeriod(period)
    })
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
      const currentLayouts = (filterState()?.filters as FeedFilters).layouts || []
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

export default FeedFiltersControl
