import { createEffect, createMemo, createSignal, on, onMount, Show } from 'solid-js'
import { MediaItem } from '~/graphql/generated/graphql'
import { getCdnUrl } from '~/lib/imageCache'
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
  let mediaSourceRef: MediaElementAudioSourceNode | undefined

  const [currentTrackDuration, setCurrentTrackDuration] = createSignal(0)
  const [currentTime, setCurrentTime] = createSignal(0)
  const [currentTrackIndex, setCurrentTrackIndex] = createSignal<number>(0)
  const [isPlaying, setIsPlaying] = createSignal(false)
  const [audioError, setAudioError] = createSignal<string | null>(null)

  const currentTack = createMemo(() => props.media[currentTrackIndex()])
  createEffect(
    on(
      currentTrackIndex,
      (newIndex, prevIndex) => {
        console.log('[AudioPlayer] Track index changed:', {
          from: prevIndex,
          to: newIndex,
          resettingDuration: true
        })
        setCurrentTrackDuration(0)
      },
      { defer: true }
    )
  )

  const handlePlayMedia = async (trackIndex: number) => {
    try {
      // Определяем, нужно ли воспроизводить или ставить на паузу
      const shouldPlay = trackIndex !== currentTrackIndex() || !isPlaying()
      setCurrentTrackIndex(trackIndex)

      // Диагностика состояния аудио
      console.log('[AudioPlayer] handlePlayMedia:', {
        trackIndex,
        shouldPlay,
        currentIsPlaying: isPlaying(),
        audioRef: !!audioRef,
        audioRefReadyState: audioRef?.readyState,
        audioRefSrc: audioRef?.src,
        audioContextState: audioContextRef?.state,
        gainNode: !!gainNodeRef,
        mediaSource: !!mediaSourceRef
      })

      if (audioContextRef?.state === 'suspended') {
        console.log('[AudioPlayer] Resuming suspended AudioContext')
        await audioContextRef?.resume()
      }

      if (shouldPlay) {
        setIsPlaying(true)
        if (audioRef) {
          try {
            // Проверяем готовность аудио
            if (audioRef && audioRef.readyState < 2) {
              // HAVE_CURRENT_DATA
              console.log('[AudioPlayer] Audio not ready, waiting...')
              audioRef.addEventListener(
                'canplay',
                async () => {
                  try {
                    if (audioRef) {
                      console.log('[AudioPlayer] Audio ready, starting playback')
                      await audioRef.play()
                      console.log('[AudioPlayer] Audio started playing after canplay event')
                    }
                  } catch (error) {
                    console.error('[AudioPlayer] Play error after canplay:', error)
                    setAudioError('Failed to play audio after loading')
                    setIsPlaying(false)
                  }
                },
                { once: true }
              )
            } else if (audioRef) {
              await audioRef.play()
              console.log('[AudioPlayer] Audio started playing immediately')
            }
          } catch (error) {
            console.error('[AudioPlayer] Play error:', error)
            setAudioError('Failed to play audio')
            setIsPlaying(false)
          }
        }
      } else {
        // Пауза - останавливаем воспроизведение
        console.log('[AudioPlayer] Pausing audio playback')
        setIsPlaying(false)

        if (audioRef) {
          try {
            audioRef.pause()
            console.log('[AudioPlayer] Audio paused successfully')
          } catch (error) {
            console.error('[AudioPlayer] Pause error:', error)
            setAudioError('Failed to pause audio')
          }
        }

        // Также приостанавливаем AudioContext если нужно
        if (audioContextRef?.state === 'running') {
          try {
            await audioContextRef.suspend()
            console.log('[AudioPlayer] AudioContext suspended')
          } catch (error) {
            console.error('[AudioPlayer] AudioContext suspend error:', error)
          }
        }
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
    console.log('[AudioPlayer] handleAudioEnd called')
    if (currentTrackIndex() < props.media.length - 1) {
      playNextTrack()
      return
    }

    console.log('[AudioPlayer] handleAudioEnd: RESETTING TIME TO 0 (end of playlist)')
    console.trace('[AudioPlayer] handleAudioEnd stack trace')
    if (audioRef) audioRef.currentTime = 0
    setIsPlaying(false)
    setCurrentTrackIndex(0)
  }

  const handleAudioTimeUpdate = () => {
    const newTime = audioRef?.currentTime || 0
    console.log('[AudioPlayer] timeUpdate:', { newTime })
    setCurrentTime(newTime)
  }

  const handleAudioError = (event: Event) => {
    console.error('[AudioPlayer] Audio error:', event)
    const audioElement = event.target as HTMLAudioElement
    const currentSrc = audioElement.src

    // Если ошибка с квотером, попробуем оригинальный URL
    if (currentSrc.includes('files.dscrs.site') && currentTack()?.url) {
      const originalUrl = currentTack()?.url
      if (originalUrl && !originalUrl.includes('files.dscrs.site')) {
        console.log('[AudioPlayer] Retrying with original URL:', originalUrl)
        // Используем processAudioUrl для правильной обработки URL
        audioElement.src = originalUrl
        setAudioError(null)
        return
      }
    }

    setAudioError('Audio loading error')
    setIsPlaying(false)
  }

  const handleAudioLoadStart = () => {
    setAudioError(null)
  }

  // Инициализация AudioContext после установки audioRef
  createEffect(() => {
    if (audioRef && audioContextRef && gainNodeRef && !mediaSourceRef) {
      try {
        console.log('[AudioPlayer] Connecting AudioContext via createEffect')
        mediaSourceRef = audioContextRef.createMediaElementSource(audioRef)
        mediaSourceRef.connect(gainNodeRef).connect(audioContextRef.destination)
        console.log('[AudioPlayer] AudioContext connected successfully via createEffect')
      } catch (error) {
        console.error('[AudioPlayer] AudioContext connection error in createEffect:', error)
        setAudioError('Audio context error')
      }
    }
  })

  onMount(() => {
    try {
      audioContextRef = new AudioContext()
      gainNodeRef = audioContextRef.createGain()
      console.log('[AudioPlayer] AudioContext initialized')

      // Принудительно подключаем AudioContext после небольшой задержки только если createEffect не сработал
      setTimeout(() => {
        if (audioRef && audioContextRef && gainNodeRef && !mediaSourceRef) {
          try {
            console.log('[AudioPlayer] Connecting AudioContext via onMount timeout fallback')
            mediaSourceRef = audioContextRef.createMediaElementSource(audioRef)
            mediaSourceRef.connect(gainNodeRef).connect(audioContextRef.destination)
            console.log('[AudioPlayer] AudioContext connected in onMount timeout')
          } catch (error) {
            console.error('[AudioPlayer] AudioContext connection error in onMount:', error)
            setAudioError('Audio context connection failed')
          }
        }
      }, 100)
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

    console.log('[AudioPlayer] playPrevTrack:', {
      from: currentTrackIndex(),
      to: newCurrentTrackIndex
    })

    // Сбрасываем время и останавливаем воспроизведение при смене трека
    console.log('[AudioPlayer] playPrevTrack: RESETTING TIME TO 0')
    console.trace('[AudioPlayer] playPrevTrack stack trace')
    setCurrentTime(0)
    setIsPlaying(false)
    setCurrentTrackIndex(newCurrentTrackIndex)
  }

  const playNextTrack = () => {
    let newCurrentTrackIndex = currentTrackIndex() + 1
    if (newCurrentTrackIndex > props.media.length - 1) {
      newCurrentTrackIndex = props.media.length - 1
    }

    console.log('[AudioPlayer] playNextTrack:', {
      from: currentTrackIndex(),
      to: newCurrentTrackIndex
    })

    // Сбрасываем время и останавливаем воспроизведение при смене трека
    console.log('[AudioPlayer] playNextTrack: RESETTING TIME TO 0')
    console.trace('[AudioPlayer] playNextTrack stack trace')
    setCurrentTime(0)
    setIsPlaying(false)
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
  const scrub = async (event: MouseEvent | undefined) => {
    if (!event || !audioRef || currentTrackDuration() <= 0) {
      return
    }

    const progressElement = event.currentTarget as HTMLDivElement
    const rect = progressElement.getBoundingClientRect()
    const offsetX = event.clientX - rect.left
    const width = rect.width

    // Вычисляем новую позицию
    const newTime = Math.max(0, Math.min((offsetX / width) * currentTrackDuration(), currentTrackDuration()))

    console.log('[AudioPlayer] scrub with animation flow:', {
      offsetX,
      width,
      newTime,
      duration: currentTrackDuration(),
      wasPlaying: isPlaying()
    })

    const wasPlaying = isPlaying()

    // 1. Останавливаем воспроизведение для плавной анимации
    if (wasPlaying && audioRef) {
      audioRef.pause()
      setIsPlaying(false)
      console.log('[AudioPlayer] scrub: paused for seek animation')
    }

    // 2. Устанавливаем новое время и обновляем UI
    audioRef.currentTime = newTime
    setCurrentTime(newTime)

    // 3. Ждем анимацию (100ms) для плавного UX
    await new Promise((resolve) => setTimeout(resolve, 100))

    // 4. Запускаем воспроизведение с новой позиции
    if (wasPlaying) {
      try {
        setIsPlaying(true)
        await audioRef.play()
        console.log('[AudioPlayer] scrub: resumed playback at', newTime)
      } catch (error) {
        console.error('[AudioPlayer] scrub: failed to resume playback:', error)
        setIsPlaying(false)
      }
    } else {
      console.log('[AudioPlayer] scrub: seek completed, staying paused')
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
        <AudioTimeLine currentTime={currentTime()} currentTrackDuration={currentTrackDuration()} onScrub={scrub} />

        {/* Показываем ошибку если есть */}
        <Show when={audioError()}>
          <div style={{ color: 'red', padding: '10px', 'text-align': 'center' }}>Error: {audioError()}</div>
        </Show>

        <audio
          ref={(el) => (audioRef = el)}
          onTimeUpdate={handleAudioTimeUpdate}
          onLoadStart={handleAudioLoadStart}
          src={getCdnUrl(currentTack()?.url || '')}
          onCanPlay={() => {
            console.log('[AudioPlayer] onCanPlay:', {
              currentTime: audioRef?.currentTime
            })
            // Никакого автоплея - только логирование для диагностики
          }}
          onLoadedMetadata={({ currentTarget }) => {
            const duration = currentTarget.duration
            console.log('[AudioPlayer] Metadata loaded:', {
              duration,
              isValid: duration > 0,
              currentTime: currentTarget.currentTime,
              readyState: currentTarget.readyState,
              trackIndex: currentTrackIndex(),
              trackUrl: currentTack()?.url
            })

            if (duration > 0) {
              setCurrentTrackDuration(duration)
              console.log('[AudioPlayer] Duration set to:', duration)
            } else {
              console.warn('[AudioPlayer] Invalid duration received:', duration)
            }
          }}
          onEnded={handleAudioEnd}
          onError={handleAudioError}
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
