import { createEffect, createMemo, createSignal, on, onMount, Show } from 'solid-js'

import { cdnUrl } from '~/config'
import { MediaItem } from '~/graphql/schema/core.gen'
import { AudioTimeLine } from './AudioTimeLine'
import { PlayerHeader } from './PlayerHeader'
import { PlayerPlaylist } from './PlayerPlaylist'

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

export const AudioPlayer = (props: Props) => {
  let audioRef: HTMLAudioElement | undefined
  let gainNodeRef: GainNode | undefined
  let audioContextRef: AudioContext | undefined

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

  /**
   * Обрабатывает перемотку аудио при взаимодействии с прогресс-баром
   * @param event Событие мыши
   */
  const scrub = (event: MouseEvent | undefined) => {
    if (event && audioRef) {
      const progressElement = event.currentTarget as HTMLDivElement
      const offsetX = event.offsetX
      const width = progressElement.offsetWidth
      audioRef.currentTime = (offsetX / width) * currentTrackDuration()
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
        <AudioTimeLine
          currentTime={currentTime()}
          currentTrackDuration={currentTrackDuration()}
          onScrub={scrub}
        />
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
