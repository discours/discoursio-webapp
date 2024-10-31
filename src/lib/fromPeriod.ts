export enum PeriodType {
  AllTime = 'all time',
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Year = 'year',
}

export const getFromDate = (period: PeriodType) => {
  const now = new Date()
  let d: Date = now
  switch (period) {
    case PeriodType.Week: {
      d = new Date(now.setMonth(now.getDate() - 7))
      break
    }
    case PeriodType.Month: {
      d = new Date(now.setMonth(now.getMonth() - 1))
      break
    }
    case PeriodType.Year: {
      d = new Date(now.setFullYear(now.getFullYear() - 1))
      break
    }
    case PeriodType.Day: {
      d = new Date(now.setDate(now.getDate() - 1))
      break
    }
    case PeriodType.AllTime:
    default:
      return 0
  }
  return Math.floor(d.getTime() / 1000)
}
