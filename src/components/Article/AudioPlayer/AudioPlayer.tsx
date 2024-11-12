import { Show, createEffect, createMemo, createSignal, on, onMount } from 'solid-js'

import { cdnUrl } from '~/config'
import { MediaItem } from '~/graphql/schema/core.gen'
import { PlayerHeader } from './PlayerHeader'
import { PlayerPlaylist } from './PlayerPlaylist'

import styles from './AudioPlayer.module.scss'

type Props = {
  media: MediaItem[]
  articleSlug?: string
  body?: string
  editorMode?: boolean
  onMediaItemFieldChange?: (
    index: number,
    field: keyof MediaItem | string | number | symbol,
    value: string
  ) => void
  onChangeMediaIndex?: (direction: 'up' | 'down', index: number) => void
}

const getFormattedTime = (point: number) => new Date(point * 1000).toISOString().slice(14, -5)

export const AudioPlayer = (props: Props) => {
  let audioRef: HTMLAudioElement | undefined
  let gainNodeRef: GainNode | undefined
  let progressRef: HTMLDivElement | undefined
  let audioContextRef: AudioContext | undefined
  let mouseDownRef: boolean | undefined

  const [currentTrackDuration, setCurrentTrackDuration] = createSignal(0)
  const [currentTime, setCurrentTime] = createSignal(0)
  const [currentTrackIndex, setCurrentTrackIndex] = createSignal<number>(0)
  const [isPlaying, setIsPlaying] = createSignal(false)

  const currentTack = createMemo(() => props.media[currentTrackIndex()])
  createEffect(on(currentTrackIndex, () => setCurrentTrackDuration(0), { defer: true }))

  const handlePlayMedia = async (trackIndex: number) => {
    setIsPlaying(!isPlaying() || trackIndex !== currentTrackIndex())
    setCurrentTrackIndex(trackIndex)

    if (audioContextRef?.state === 'suspended') {
      await audioContextRef?.resume()
    }

    if (isPlaying()) {
      await audioRef?.play()
    } else {
      audioRef?.pause()
    }
  }

  const handleVolumeChange = (volume: number) => {
    if (gainNodeRef) gainNodeRef.gain.value = volume
  }

  const handleAudioEnd = () => {
    if (currentTrackIndex() < props.media.length - 1) {
      playNextTrack()
      return
    }

    if (audioRef) audioRef.currentTime = 0
    setIsPlaying(false)
    setCurrentTrackIndex(0)
  }

  const handleAudioTimeUpdate = () => {
    setCurrentTime(audioRef?.currentTime || 0)
  }

  onMount(() => {
    audioContextRef = new AudioContext()
    gainNodeRef = audioContextRef.createGain()
    if (audioRef) {
      const track = audioContextRef?.createMediaElementSource(audioRef)
      track.connect(gainNodeRef).connect(audioContextRef?.destination)
    }
  })

  const playPrevTrack = () => {
    let newCurrentTrackIndex = currentTrackIndex() - 1
    if (newCurrentTrackIndex < 0) {
      newCurrentTrackIndex = 0
    }

    setCurrentTrackIndex(newCurrentTrackIndex)
  }

  const playNextTrack = () => {
    let newCurrentTrackIndex = currentTrackIndex() + 1
    if (newCurrentTrackIndex > props.media.length - 1) {
      newCurrentTrackIndex = props.media.length - 1
    }

    setCurrentTrackIndex(newCurrentTrackIndex)
  }

  const handleMediaItemFieldChange = (
    index: number,
    field: keyof MediaItem | string | number | symbol,
    value: string
  ) => {
    props.onMediaItemFieldChange?.(index, field, value)
  }

  const scrub = (event: MouseEvent | undefined) => {
    if (progressRef && audioRef) {
      audioRef.currentTime = (event?.offsetX || 0 / progressRef.offsetWidth) * currentTrackDuration()
    }
  }

  return (
    <div>
      <Show when={props.media}>
        <PlayerHeader
          onPlayMedia={() => handlePlayMedia(currentTrackIndex())}
          playPrevTrack={playPrevTrack}
          playNextTrack={playNextTrack}
          onVolumeChange={handleVolumeChange}
          isPlaying={isPlaying()}
          currentTrack={currentTack()}
        />
        <div class={styles.timeline}>
          <div
            class={styles.progress}
            ref={(el) => (progressRef = el)}
            onClick={scrub}
            onMouseMove={(e) => mouseDownRef && scrub(e)}
            onMouseDown={() => (mouseDownRef = true)}
            onMouseUp={() => (mouseDownRef = false)}
          >
            <div
              class={styles.progressFilled}
              style={{
                width: `${(currentTime() / currentTrackDuration()) * 100 || 0}%`
              }}
            />
          </div>
          <div class={styles.progressTiming}>
            <span>{getFormattedTime(currentTime())}</span>
            <Show when={currentTrackDuration() > 0}>
              <span>{getFormattedTime(currentTrackDuration())}</span>
            </Show>
          </div>
          <audio
            ref={(el) => (audioRef = el)}
            onTimeUpdate={handleAudioTimeUpdate}
            src={currentTack()?.url?.replace('images.discours.io', cdnUrl) || ''}
            onCanPlay={() => {
              // start to play the next track on src change
              if (isPlaying() && audioRef) {
                audioRef.play()
              }
            }}
            onLoadedMetadata={({ currentTarget }) => setCurrentTrackDuration(currentTarget.duration)}
            onEnded={handleAudioEnd}
            crossorigin="anonymous"
          />
        </div>
        <PlayerPlaylist
          editorMode={props.editorMode}
          onPlayMedia={handlePlayMedia}
          onChangeMediaIndex={(direction, index) => props.onChangeMediaIndex?.(direction, index)}
          isPlaying={isPlaying()}
          media={props.media}
          currentTrackIndex={currentTrackIndex()}
          articleSlug={props.articleSlug}
          body={props.body}
          onMediaItemFieldChange={handleMediaItemFieldChange}
        />
      </Show>
    </div>
  )
}
