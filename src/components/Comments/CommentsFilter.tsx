import { useLocation } from '@solidjs/router'
import { createEffect, createSignal, on } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { ReactionKind, ReactionSort } from '~/graphql/schema/core.gen'
import { PeriodType, getTimestampFromPeriod } from '~/lib/fromPeriod'
import { capitalize } from '~/utils/capitalize'
import { FeedSwitcher } from '../Feed/FeedSwitcher/FeedSwitcher'
import { DropDown, Option, OptionGroup } from '../_shared/DropDown/DropDown'

import styles from '~/styles/views/Feed.module.scss'

export interface CommentsFilterProps {
  shoutId?: number
  onChange?: (filters: { sort?: ReactionSort; kind?: ReactionKind; after?: number }) => void
  currentSort?: ReactionSort
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

export const CommentsFilter = (props: CommentsFilterProps) => {
  const { t } = useLocalize()

  const [currentPeriod, setCurrentPeriod] = createSignal<PeriodType>(PeriodType.AllTime)

  // Синхронизируем период при изменении фильтров
  createEffect(
    on([currentPeriod, () => loc.pathname], ([period, pathname]) => {
      const sort = pathname === '/comments/likes' ? ReactionSort.Like : ReactionSort.Newest
      const after =
        period === PeriodType.AllTime ? undefined : Math.floor(getTimestampFromPeriod(period) / 1000)

      props.onChange?.({ sort, kind: ReactionKind.Comment, after })
    })
  )

  // Обработчик периода
  const periodHandler = (opt: Option) => {
    if (!opt?.value) return
    const period = opt.value as PeriodType
    setCurrentPeriod(period || PeriodType.AllTime)
  }

  // Создаем группы опций
  const asOptionsGroup = (
    opts: string[],
    title?: string,
    onChange?: (option: Option) => void
  ): OptionGroup => {
    const options = opts.map((o) => ({
      value: o,
      title: title === '' ? getPeriodTitle(o as PeriodType) : t(capitalize(o))
    }))

    return {
      options,
      selected: [options.findIndex((o) => o.value === currentPeriod())],
      onChange
    }
  }
  const loc = useLocation()
  return (
    <div class={styles.dropdowns}>
      <FeedSwitcher options={['newest', 'likes']} prefix={`${loc.pathname}`} />
      <DropDown
        popupProps={{ horizontalAnchor: 'right' }}
        options={[asOptionsGroup(Object.values(PeriodType), '', periodHandler)]}
        triggerCssClass={styles.periodSwitcher}
      />
    </div>
  )
}
