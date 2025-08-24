/**
 * Проверяет валидность временной метки и конвертирует из UNIX timestamp при необходимости
 *
 * @param timestamp Временная метка для проверки (может быть как в секундах из Python, так и в миллисекундах)
 * @returns Валидированная метка времени в миллисекундах или текущее время
 */
export const validateTimestamp = (timestamp: number | undefined | null): number => {
  const now = Date.now()
  const minValidDate = new Date('2020-01-01').getTime() // Минимальная валидная дата (1 января 2020)
  const maxValidDate = now + 86400000 // Максимальная валидная дата (сегодня + 1 день)

  // Если timestamp отсутствует, используем текущее время
  if (timestamp === undefined || timestamp === null) {
    return now
  }

  // Преобразуем UNIX timestamp (секунды) в миллисекунды, если нужно
  // Если timestamp меньше определенного порога (например, 2147483648 - 01/19/2038),
  // то считаем, что это секунды, а не миллисекунды
  const ts = timestamp < 2147483648 ? timestamp * 1000 : timestamp

  // Проверяем, находится ли метка в разумных пределах
  if (ts < minValidDate || ts > maxValidDate) {
    console.warn(`[timestamp] Invalid timestamp detected: ${new Date(ts).toISOString()}, using current time instead`)
    return now
  }

  return ts
}

/**
 * Обрабатывает временную метку, полученную с сервера
 * @param timestamp Временная метка в любом формате (секунды или миллисекунды)
 * @returns Валидированная временная метка в миллисекундах
 */
export const processServerTimestamp = (timestamp: number | undefined | null): number => {
  return validateTimestamp(timestamp)
}
