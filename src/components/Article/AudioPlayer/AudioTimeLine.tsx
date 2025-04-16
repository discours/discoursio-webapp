import { Show } from 'solid-js'

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
  let mouseDownRef: boolean | undefined
  return (
    <div class={styles.timeline}>
      <div
        class={styles.progress}
        ref={(el) => (progressRef = el)}
        onClick={(e) => props.onScrub(e)}
        onMouseMove={(e) => mouseDownRef && props.onScrub(e)}
        onMouseDown={() => (mouseDownRef = true)}
        onMouseUp={() => (mouseDownRef = false)}
      >
        <div
          class={styles.progressFilled}
          style={{
            width: `${(props.currentTime / props.currentTrackDuration) * 100 || 0}%`
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
