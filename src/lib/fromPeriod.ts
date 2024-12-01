export enum PeriodType {
  AllTime = 'all time',
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Year = 'year'
}

export const getTimestampFromPeriod = (period: PeriodType) => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const d: Date = new Date(now)

  switch (period) {
    case PeriodType.Week: {
      d.setDate(d.getDate() - 7)
      break
    }
    case PeriodType.Month: {
      d.setMonth(d.getMonth() - 1)
      break
    }
    case PeriodType.Year: {
      d.setFullYear(d.getFullYear() - 1)
      break
    }
    case PeriodType.Day: {
      d.setDate(d.getDate() - 1)
      break
    }
    // case PeriodType.AllTime:
    default:
      return 0
  }

  return Math.floor(d.getTime() / 1000)
}

export const getShortDate = (date: Date) => date.toISOString().slice(0, 10) // 2023-12-31
export const getUnixtime = (date: Date) => Math.floor(date.getTime() / 1000) as number

export function getPeriodTitle(period: PeriodType): string {
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
