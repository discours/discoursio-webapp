import { createSignal } from 'solid-js'

import styles from './AudioPlayer.module.scss'

/**
 * Форматирует время из секунд в формат mm:ss
 * @param point Время в секундах
 * @returns Отформатированное время в формате mm:ss
 */
export const getFormattedTime = (point: number) => new Date(point * 1000).toISOString().slice(14, -5)

/**
 * Компонент временной шкалы для аудиоплеера
 * @param props Свойства компонента
 * @param props.currentTime Текущее время воспроизведения в секундах
 * @param props.currentTrackDuration Общая продолжительность трека в секундах
 * @param props.onScrub Функция, вызываемая при перемотке трека
 * @returns Компонент временной шкалы
 * @example
 * ```tsx
 * <TimeLine
 *   currentTime={currentTime()}
 *   currentTrackDuration={currentTrackDuration()}
 *   onScrub={scrub}
 * />
 * ```
 */
export const AudioTimeLine = (props: {
  currentTime: number
  currentTrackDuration: number
  onScrub: (event: MouseEvent | undefined) => void
  onPreviewTime?: (time: number | null) => void
}) => {
  let progressRef: HTMLDivElement | undefined
  const [isPressed, setIsPressed] = createSignal(false)
  const [hasDragged, setHasDragged] = createSignal(false)

  // Вычисляет время из позиции клика/касания
  const getTimeFromEvent = (e: MouseEvent | TouchEvent): number => {
    const progressElement = e.currentTarget as HTMLDivElement
    const rect = progressElement.getBoundingClientRect()

    // Получаем clientX в зависимости от типа события
    const clientX = 'touches' in e ? e.touches[0]?.clientX || e.changedTouches[0]?.clientX : e.clientX
    const offsetX = clientX - rect.left
    const width = rect.width

    if (width <= 0 || props.currentTrackDuration <= 0) return 0

    return Math.max(0, Math.min((offsetX / width) * props.currentTrackDuration, props.currentTrackDuration))
  }

  const handleClick = (e: MouseEvent) => {
    // Не обрабатываем клик если было перетаскивание
    if (hasDragged()) {
      console.log('[AudioTimeLine] handleClick - ignored after drag')
      setHasDragged(false)
      return
    }
    console.log('[AudioTimeLine] handleClick - processing')
    props.onScrub(e)
  }

  const handleMouseDown = (e: MouseEvent) => {
    console.log('[AudioTimeLine] handleMouseDown')
    e.preventDefault()
    setIsPressed(true)
    setHasDragged(false)
    // Время уже показано в onMouseMove при hover
  }

  const handleMouseUp = (e: MouseEvent) => {
    console.log('[AudioTimeLine] handleMouseUp')
    if (isPressed()) {
      // Выполняем фактическую перемотку только при mouseUp
      console.log('[AudioTimeLine] Executing actual scrub')
      props.onScrub(e)
    }
    setIsPressed(false)
  }

  const handleMouseMove = (e: MouseEvent) => {
    // Всегда показываем предварительное время при движении мыши
    const previewTime = getTimeFromEvent(e)
    console.log('[AudioTimeLine] Preview time on hover/move:', previewTime)
    props.onPreviewTime?.(previewTime)

    if (isPressed()) {
      console.log('[AudioTimeLine] handleMouseMove (dragging)')
      setHasDragged(true)
    }
  }

  const handleMouseLeave = () => {
    console.log('[AudioTimeLine] handleMouseLeave')
    setIsPressed(false)
    // Скрываем предварительное время при уходе курсора
    props.onPreviewTime?.(null)
  }

  // Touch обработчики
  const handleTouchStart = (e: TouchEvent) => {
    console.log('[AudioTimeLine] handleTouchStart')
    e.preventDefault()
    setIsPressed(true)
    setHasDragged(false)

    // Показываем предварительное время
    const previewTime = getTimeFromEvent(e)
    console.log('[AudioTimeLine] Preview time (touch):', previewTime)
    props.onPreviewTime?.(previewTime)
  }

  const handleTouchEnd = (e: TouchEvent) => {
    console.log('[AudioTimeLine] handleTouchEnd')
    if (isPressed()) {
      // Выполняем фактическую перемотку только при touchEnd
      console.log('[AudioTimeLine] Executing actual scrub (touch)')
      // Создаем MouseEvent-подобный объект для совместимости с onScrub
      // biome-ignore lint/suspicious/noExplicitAny: fake mouse event
      const fakeMouseEvent = e as any
      props.onScrub(fakeMouseEvent)
    }
    setIsPressed(false)
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (isPressed()) {
      console.log('[AudioTimeLine] handleTouchMove (dragging)')
      setHasDragged(true)

      // Показываем предварительное время во время перетаскивания
      const previewTime = getTimeFromEvent(e)
      console.log('[AudioTimeLine] Preview time during touch drag:', previewTime)
      props.onPreviewTime?.(previewTime)
    }
  }

  // Вычисляем процент прогресса с защитой от деления на ноль
  const progressPercentage = () => {
    if (props.currentTrackDuration <= 0) return 0
    return Math.min((props.currentTime / props.currentTrackDuration) * 100, 100)
  }

  return (
    <div class={styles.timeline}>
      <div
        class={styles.progress}
        ref={(el) => (progressRef = el)}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => setIsPressed(false)}
      >
        <div
          class={styles.progressFilled}
          style={{
            width: `${progressPercentage()}%`
          }}
        />
      </div>
      <div class={styles.progressTiming}>
        <span>{getFormattedTime(props.currentTime)}</span>
        <span>{props.currentTrackDuration > 0 ? getFormattedTime(props.currentTrackDuration) : '00:00'}</span>
      </div>
    </div>
  )
}
