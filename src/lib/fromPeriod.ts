export enum PeriodType {
  AllTime = 'all time',
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Year = 'year'
}

export const getFromDate = (period: PeriodType) => {
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
