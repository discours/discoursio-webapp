import { createSignal, Show } from 'solid-js'

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
}) => {
  let progressRef: HTMLDivElement | undefined
  const [isMouseDown, setIsMouseDown] = createSignal(false)
  
  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    setIsMouseDown(true)
    props.onScrub(e)
  }
  
  const handleMouseUp = () => {
    setIsMouseDown(false)
  }
  
  const handleMouseMove = (e: MouseEvent) => {
    if (isMouseDown()) {
      props.onScrub(e)
    }
  }
  
  const handleClick = (e: MouseEvent) => {
    props.onScrub(e)
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
        onMouseLeave={handleMouseUp}
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
        <Show when={props.currentTrackDuration > 0}>
          <span>{getFormattedTime(props.currentTrackDuration)}</span>
        </Show>
      </div>
    </div>
  )
}
