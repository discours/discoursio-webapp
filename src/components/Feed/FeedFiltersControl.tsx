import clsx from 'clsx'
import { Show, createMemo, createSignal, onMount } from 'solid-js'
import { For } from 'solid-js'
import { Icon } from '~/components/_shared/Icon/Icon'
import { EXPO_LAYOUTS, useFeed } from '~/context/feed'
import { useLocalize } from '~/context/localize'
import { getTimestampFromPeriod } from '~/lib/fromPeriod'
import { PeriodType } from '~/lib/fromPeriod'
import { ExpoLayoutType } from '~/types/nav'
import { FeaturedFilter, FeedFilters } from '~/types/nav'
import { capitalize } from '~/utils/capitalize'
import { DropDown } from '../_shared/DropDown/DropDown'
import type { Option } from '../_shared/DropDown/DropDown'

import { TFunction } from 'i18next'
import styles from '~/styles/views/Feed.module.scss'

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

// Компонент для симметричной стрелочки вниз (используем тот же дизайн что и в DropDown)
const ChevronDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path
      d="M4.5 6.75L9 11.25L13.5 6.75"
      stroke="#141414"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
)

// Компонент для отображения выбранных лейаутов в виде иконок
const _LayoutFilterTrigger = (props: {
  selectedLayouts: (ExpoLayoutType | 'article')[]
  allLayouts: (ExpoLayoutType | 'article')[]
  onToggle: (isOpen: boolean) => void
}) => {
  const { t } = useLocalize()

  // Если ничего не выбрано или выбрано все, показываем текст
  if (props.selectedLayouts.length === 0 || props.selectedLayouts.length === props.allLayouts.length) {
    return (
      <div class={clsx(styles.trigger, styles.nonSelectable)}>
        {t('All')}
        <ChevronDown />
      </div>
    )
  }
  return (
    <div class={clsx(styles.trigger, styles.layoutIconsTrigger, styles.nonSelectable)}>
      <For each={props.selectedLayouts}>
        {(layout) => (
          <Icon name={layout === 'article' ? 'create-article' : layout} class={styles.layoutIcon} />
        )}
      </For>
      <ChevronDown />
    </div>
  )
}

// Компонент для отображения выбранного featured фильтра
const FeaturedFilterTrigger = (props: {
  selectedFilter: FeaturedFilter
  onToggle: (isOpen: boolean) => void
}) => {
  const { t } = useLocalize()

  return (
    <div class={clsx(styles.trigger, styles.nonSelectable)}>
      {t(capitalize(props.selectedFilter))}
      <ChevronDown />
    </div>
  )
}

// Компонент для отображения комбинации featured фильтра и лейаутов
const CombinedFilterTrigger = (props: {
  selectedFilter: FeaturedFilter
  selectedLayouts: (ExpoLayoutType | 'article')[]
  allLayouts: (ExpoLayoutType | 'article')[]
  onToggle: (isOpen: boolean) => void
}) => {
  const { t } = useLocalize()

  return (
    <div class={clsx(styles.trigger, styles.layoutIconsTrigger, styles.nonSelectable)}>
      <span class={styles.featuredText}>{t(capitalize(props.selectedFilter))}</span>
      <div class={styles.layoutIconsGroup}>
        <For each={props.selectedLayouts}>
          {(layout) => (
            <Icon name={layout === 'article' ? 'create-article' : layout} class={styles.layoutIcon} />
          )}
        </For>
      </div>
      <ChevronDown />
    </div>
  )
}

export const FeedFiltersControl = () => {
  const { t } = useLocalize()
  const { filterState, updateFilters } = useFeed()

  const [currentPeriod, setCurrentPeriod] = createSignal<PeriodType>(PeriodType.AllTime)
  const [currentFeaturedFilter, setCurrentFeaturedFilter] = createSignal<FeaturedFilter>('all')
  const [currentLayouts, setCurrentLayouts] = createSignal<(ExpoLayoutType | 'article')[]>([])

  // Состояние для отложенного применения фильтров
  const [pendingPeriod, setPendingPeriod] = createSignal<PeriodType>(PeriodType.AllTime)
  const [pendingFeaturedFilter, setPendingFeaturedFilter] = createSignal<FeaturedFilter>('all')
  const [pendingLayouts, setPendingLayouts] = createSignal<(ExpoLayoutType | 'article')[]>([])
  const [hasChanges, setHasChanges] = createSignal(false)

  // Проверяем есть ли изменения
  const checkForChanges = () => {
    const periodChanged = pendingPeriod() !== currentPeriod()
    const featuredChanged = pendingFeaturedFilter() !== currentFeaturedFilter()
    const layoutsChanged =
      JSON.stringify(pendingLayouts().sort()) !== JSON.stringify(currentLayouts().sort())

    setHasChanges(periodChanged || featuredChanged || layoutsChanged)
  }

  // Синхронизируем начальные фильтры
  onMount(() => {
    const filters = filterState()?.filters as FeedFilters

    // Синхронизация featured фильтра
    if (filters.featured !== undefined) {
      const featured =
        filters.featured === true ? 'featured' : filters.featured === false ? 'unfeatured' : 'all'
      setCurrentFeaturedFilter(featured)
      setPendingFeaturedFilter(featured)
    }

    // Синхронизация периода
    if (filters.after !== undefined) {
      const period = Object.values(PeriodType).find((p) => getTimestampFromPeriod(p) === filters.after)
      if (period) {
        setCurrentPeriod(period)
        setPendingPeriod(period)
      }
    }

    // Синхронизация layouts
    if (filters.layouts?.length) {
      const layouts = filters.layouts as (ExpoLayoutType | 'article')[]
      setCurrentLayouts(layouts)
      setPendingLayouts(layouts)
    }
  })

  // Обработчик фильтра featured (отложенное применение)
  const featuredFilterHandler = (opt: Option) => {
    if (!opt?.value) return
    const mode = opt.value as FeaturedFilter
    setPendingFeaturedFilter(mode)
    checkForChanges()
  }

  // Улучшенный обработчик layouts с поддержкой множественного выбора (отложенное применение)
  const layoutsOptionsGroupHandler = (opt: Option) => {
    if (!opt?.value) return

    const layouts = pendingLayouts()
    const newLayouts = layouts.includes(opt.value as ExpoLayoutType | 'article')
      ? layouts.filter((x) => x !== opt.value)
      : [...layouts, opt.value as ExpoLayoutType | 'article']

    setPendingLayouts(newLayouts)
    checkForChanges()
  }

  // Обработчик периода (отложенное применение)
  const periodHandler = (opt: Option) => {
    if (!opt?.value) return
    const period = opt.value as PeriodType

    setPendingPeriod(period || PeriodType.AllTime)
    checkForChanges()
  }

  // Применение фильтров
  const applyFilters = () => {
    setCurrentPeriod(pendingPeriod())
    setCurrentFeaturedFilter(pendingFeaturedFilter())
    setCurrentLayouts(pendingLayouts())

    const filters = {
      featured:
        pendingFeaturedFilter() === 'featured'
          ? true
          : pendingFeaturedFilter() === 'unfeatured'
            ? false
            : undefined,
      after: pendingPeriod() === PeriodType.AllTime ? undefined : getTimestampFromPeriod(pendingPeriod()),
      layouts: pendingLayouts().length ? pendingLayouts() : undefined
    }

    updateFilters(filters)

    setHasChanges(false)
  }

  // Мемоизируем создание опций с учетом типа OptionGroup
  const createOptionsGroup = createMemo(() => {
    const featuredOptions = ['all', 'featured', 'unfeatured'].map((o) => ({
      value: o,
      title: t(capitalize(o))
    })) satisfies Option[]

    const layoutOptions = ['article', ...EXPO_LAYOUTS].map((o) => ({
      value: o,
      title: t(capitalize(o)),
      icon: o === 'article' ? 'create-article' : o
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

  // Мемоизируем создание групп dropdown для правильной реактивности
  const getDropdownGroups = createMemo(() => {
    const options = createOptionsGroup()
    const featuredSelectedIndex = options.featured.findIndex((o) => o.value === pendingFeaturedFilter())

    return [
      {
        options: options.featured,
        selected: featuredSelectedIndex >= 0 ? [featuredSelectedIndex] : [0], // Если не найден, используем первый (all)
        onChange: featuredFilterHandler
      },
      {
        title: t('Layouts'),
        options: options.layouts,
        selected: pendingLayouts()
          .map((l) => options.layouts.findIndex((o) => o.value === l))
          .filter((i) => i !== -1), // Фильтруем невалидные индексы
        multiple: true,
        onChange: layoutsOptionsGroupHandler
      }
    ]
  })

  // Мемоизируем создание групп периодов для правильной реактивности
  const getPeriodGroup = createMemo(() => {
    const options = createOptionsGroup()
    const selectedIndex = options.periods.findIndex((o) => o.value === pendingPeriod())

    return [
      {
        options: options.periods,
        selected: selectedIndex >= 0 ? [selectedIndex] : [0], // Если период не найден, используем первый (All time)
        onChange: periodHandler
      }
    ]
  })

  return (
    <div class={styles.filtersContainer}>
      <div class={styles.dropdowns}>
        <DropDown
          popupProps={{ horizontalAnchor: 'right' }}
          options={getPeriodGroup()}
          triggerCssClass={clsx(styles.periodSwitcher, {
            [styles.active]: pendingPeriod() && pendingPeriod() !== PeriodType.AllTime,
            [styles.hasChanges]: hasChanges()
          })}
        />
        <DropDown
          popupProps={{ horizontalAnchor: 'right' }}
          options={getDropdownGroups()}
          triggerCssClass={clsx(styles.periodSwitcher, {
            [styles.active]: pendingFeaturedFilter() !== 'all' || pendingLayouts().length > 0,
            [styles.hasChanges]: hasChanges()
          })}
          triggerContent={
            // Если выбраны лейауты - всегда показываем комбинированный триггер с featured фильтром
            pendingLayouts().length > 0 ? (
              <CombinedFilterTrigger
                selectedFilter={pendingFeaturedFilter()}
                selectedLayouts={pendingLayouts()}
                allLayouts={['article', ...(EXPO_LAYOUTS as ExpoLayoutType[])]}
                onToggle={(_isOpen) => {}}
              />
            ) : (
              <FeaturedFilterTrigger selectedFilter={pendingFeaturedFilter()} onToggle={(_isOpen) => {}} />
            )
          }
        />
      </div>
      <Show when={hasChanges()}>
        <div class={styles.buttons}>
          <button onClick={applyFilters} disabled={!hasChanges()} class={styles.applyButton}>
            <Icon name="filter" style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
      </Show>
    </div>
  )
}

export default FeedFiltersControl
