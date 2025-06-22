import { clsx } from 'clsx'
import { createSignal, Show } from 'solid-js'

import { Icon } from '~/components/_shared/Icon'
import { MediaItem } from '~/graphql/schema/core.gen'
import { useOutsideClickHandler } from '~/lib/useOutsideClickHandler'
import styles from './AudioPlayer.module.scss'

type Props = {
  onPlayMedia: () => void
  playPrevTrack: () => void
  playNextTrack: () => void
  onVolumeChange: (volume: number) => void
  isPlaying: boolean
  currentTrack: MediaItem
}

export const PlayerHeader = (props: Props) => {
  let volumeContainerRef: HTMLDivElement | undefined
  const [isVolumeBarOpened, setIsVolumeBarOpened] = createSignal(false)

  const toggleVolumeBar = () => {
    setIsVolumeBarOpened(!isVolumeBarOpened())
  }

  useOutsideClickHandler({
    containerRef: volumeContainerRef,
    predicate: () => isVolumeBarOpened(),
    handler: () => toggleVolumeBar()
  })

  return (
    <div class={styles.playerHeader}>
      <div class={styles.playerTitle}>{props.currentTrack.title}</div>
      <div class={styles.playerControls}>
        <button
          type="button"
          onClick={props.onPlayMedia}
          class={clsx(
            styles.playButton,
            props.isPlaying ? styles.playButtonInvertPause : styles.playButtonInvertPlay
          )}
          aria-label="Play"
          data-playing="false"
        >
          <Icon name={props.isPlaying ? 'pause' : 'play'} />
        </button>
        <button
          type="button"
          onClick={props.playPrevTrack}
          class={clsx(styles.controlsButton)}
          aria-label="Previous"
        >
          <Icon name="player-arrow" />
        </button>
        <button
          type="button"
          onClick={props.playNextTrack}
          class={clsx(styles.controlsButton, styles.controlsButtonNext)}
          aria-label="Next"
        >
          <Icon name="player-arrow" />
        </button>
        <div ref={(el) => (volumeContainerRef = el)} class={styles.volumeContainer}>
          <Show when={isVolumeBarOpened()}>
            <input
              type="range"
              id="volume"
              min="0"
              max="1"
              value="1"
              step="0.01"
              class={styles.volume}
              onChange={({ target }) => props.onVolumeChange(Number(target.value))}
            />
          </Show>
          <button onClick={toggleVolumeBar} class={styles.volumeButton} aria-label="Volume">
            <Icon name="volume" />
          </button>
        </div>
      </div>
    </div>
  )
}
