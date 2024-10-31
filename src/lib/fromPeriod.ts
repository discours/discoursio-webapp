export type PeriodType = 'week' | 'month' | 'year' | 'day' | 'all time'

export const getFromDate = (period: PeriodType): number => {
  const now = new Date()
  let d: Date = now
  switch (period) {
    case 'week': {
      d = new Date(now.setMonth(now.getDate() - 7))
      break
    }
    case 'month': {
      d = new Date(now.setMonth(now.getMonth() - 1))
      break
    }
    case 'year': {
      d = new Date(now.setFullYear(now.getFullYear() - 1))
      break
    }
    case 'day': {
      d = new Date(now.setDate(now.getDate() - 1))
      break
    }
    case 'all time':
    default:
      return 0
  }
  return Math.floor(d.getTime() / 1000)
}
