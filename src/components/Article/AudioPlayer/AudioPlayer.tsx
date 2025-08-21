import { createEffect, createMemo, createSignal, on, onMount, Show } from 'solid-js'

import { cdnUrl } from '~/config'
import { MediaItem } from '~/graphql/generated/graphql'
import { AudioTimeLine } from './AudioTimeLine'
import { PlayerHeader } from './PlayerHeader'
import { PlayerPlaylist } from './PlayerPlaylist'

type Props = {
  media: MediaItem[]
  articleSlug?: string
  body?: string
  editorMode?: boolean
  onMediaItemFieldChange?: (index: number, field: keyof MediaItem | string | number | symbol, value: string) => void
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
  const [audioError, setAudioError] = createSignal<string | null>(null)

  const currentTack = createMemo(() => props.media[currentTrackIndex()])
  createEffect(on(currentTrackIndex, () => setCurrentTrackDuration(0), { defer: true }))

  const handlePlayMedia = async (trackIndex: number) => {
    try {
      const shouldPlay = !isPlaying() || trackIndex !== currentTrackIndex()
      setCurrentTrackIndex(trackIndex)
      
      if (audioContextRef?.state === 'suspended') {
        await audioContextRef?.resume()
      }

      if (shouldPlay) {
        setIsPlaying(true)
        if (audioRef) {
          try {
            await audioRef.play()
          } catch (error) {
            console.error('[AudioPlayer] Play error:', error)
            setAudioError('Failed to play audio')
            setIsPlaying(false)
          }
        }
      } else {
        setIsPlaying(false)
        audioRef?.pause()
      }
    } catch (error) {
      console.error('[AudioPlayer] handlePlayMedia error:', error)
      setAudioError('Audio playback error')
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

  const handleAudioError = (event: Event) => {
    console.error('[AudioPlayer] Audio error:', event)
    setAudioError('Audio loading error')
    setIsPlaying(false)
  }

  const handleAudioLoadStart = () => {
    setAudioError(null)
  }

  // Инициализация AudioContext после установки audioRef
  createEffect(() => {
    if (audioRef && audioContextRef && gainNodeRef) {
      try {
        const track = audioContextRef.createMediaElementSource(audioRef)
        track.connect(gainNodeRef).connect(audioContextRef.destination)
        console.log('[AudioPlayer] AudioContext connected successfully')
      } catch (error) {
        console.error('[AudioPlayer] AudioContext connection error:', error)
        setAudioError('Audio context error')
      }
    }
  })

  onMount(() => {
    try {
      audioContextRef = new AudioContext()
      gainNodeRef = audioContextRef.createGain()
      console.log('[AudioPlayer] AudioContext initialized')
    } catch (error) {
      console.error('[AudioPlayer] AudioContext initialization error:', error)
      setAudioError('Audio context initialization failed')
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

  // Генерация правильного URL для аудио
  const getAudioUrl = (url: string | null | undefined): string => {
    if (!url) {
      console.warn('[AudioPlayer] No URL provided for audio')
      return ''
    }
    
    // Заменяем старый CDN на новый
    let audioUrl = url.replace('images.discours.io', cdnUrl)
    
    // Убираем лишние параметры
    if (audioUrl.includes('?')) {
      audioUrl = audioUrl.split('?')[0]
    }
    
    console.log('[AudioPlayer] Audio URL processing:', { 
      original: url, 
      processed: audioUrl,
      cdnUrl,
      hasUrl: !!url,
      urlType: typeof url
    })
    return audioUrl
  }

  // Диагностика медиа данных
  createEffect(() => {
    const media = props.media
    const currentTrack = currentTack()
    
    console.log('[AudioPlayer] Media data:', {
      mediaLength: media?.length,
      currentTrackIndex: currentTrackIndex(),
      currentTrack: currentTrack,
      currentTrackUrl: currentTrack?.url,
      mediaUrls: media?.map(m => m.url)
    })
  })

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
        <AudioTimeLine currentTime={currentTime()} currentTrackDuration={currentTrackDuration()} onScrub={scrub} />
        
        {/* Показываем ошибку если есть */}
        <Show when={audioError()}>
          <div style={{ color: 'red', padding: '10px', 'text-align': 'center' }}>
            Error: {audioError()}
          </div>
        </Show>
        
        <audio
          ref={(el) => (audioRef = el)}
          onTimeUpdate={handleAudioTimeUpdate}
          src={getAudioUrl(currentTack()?.url)}
          onCanPlay={() => {
            // start to play the next track on src change
            if (isPlaying() && audioRef) {
              audioRef.play().catch(error => {
                console.error('[AudioPlayer] Auto-play error:', error)
                setAudioError('Auto-play failed')
                setIsPlaying(false)
              })
            }
          }}
          onLoadedMetadata={({ currentTarget }) => setCurrentTrackDuration(currentTarget.duration)}
          onEnded={handleAudioEnd}
          onError={handleAudioError}
          onLoadStart={handleAudioLoadStart}
          crossorigin="anonymous"
          preload="metadata"
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
