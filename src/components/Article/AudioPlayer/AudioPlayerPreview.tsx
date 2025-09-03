import { createEffect, createMemo, createSignal, on, onMount, Show } from 'solid-js'
import { MediaItem } from '~/graphql/generated/graphql'
import { getCdnUrl } from '~/lib/imageCache'
import { AudioTimeLine } from './AudioTimeLine'
import { PlayerHeader } from './PlayerHeader'

type Props = {
  media: MediaItem[]
  editorMode?: boolean
  onMediaItemFieldChange?: (index: number, field: keyof MediaItem | string | number | symbol, value: string) => void
  onChangeMediaIndex?: (direction: 'up' | 'down', index: number) => void
}

/**
 * Lightweight AudioPlayer component for preview purposes without PlayerPlaylist
 * Used in AudioUploader to avoid circular imports
 */
export const AudioPlayerPreview = (props: Props) => {
  let audioRef: HTMLAudioElement | undefined
  let gainNodeRef: GainNode | undefined
  let audioContextRef: AudioContext | undefined

  const [currentTrackDuration, setCurrentTrackDuration] = createSignal(0)
  const [currentTime, setCurrentTime] = createSignal(0)
  const [currentTrackIndex, setCurrentTrackIndex] = createSignal<number>(0)
  const [isPlaying, setIsPlaying] = createSignal(false)
  const [audioError, setAudioError] = createSignal<string | null>(null)
  const [isSeeking, setIsSeeking] = createSignal(false)

  const currentTack = createMemo(() => props.media[currentTrackIndex()])
  createEffect(
    on(
      currentTrackIndex,
      (newIndex, prevIndex) => {
        console.log('[AudioPlayerPreview] Track index changed:', {
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
      console.log('[AudioPlayerPreview] handlePlayMedia:', {
        trackIndex,
        shouldPlay,
        currentIsPlaying: isPlaying(),
        audioRef: !!audioRef,
        audioRefReadyState: audioRef?.readyState,
        audioRefSrc: audioRef?.src,
        audioContextState: audioContextRef?.state,
        gainNode: !!gainNodeRef
      })

      if (audioContextRef?.state === 'suspended') {
        await audioContextRef?.resume()
      }

      if (shouldPlay) {
        setIsPlaying(true)
        if (audioRef) {
          try {
            // Проверяем готовность аудио
            if (audioRef && audioRef.readyState < 2) {
              // HAVE_CURRENT_DATA
              console.log('[AudioPlayerPreview] Audio not ready, waiting...')
              audioRef.addEventListener(
                'canplay',
                async () => {
                  try {
                    if (audioRef) {
                      await audioRef.play()
                      console.log('[AudioPlayerPreview] Audio started playing after canplay event')
                    }
                  } catch (error) {
                    console.error('[AudioPlayerPreview] Play error after canplay:', error)
                    setAudioError('Failed to play audio after loading')
                    setIsPlaying(false)
                  }
                },
                { once: true }
              )
            } else if (audioRef) {
              await audioRef.play()
              console.log('[AudioPlayerPreview] Audio started playing immediately')
            }
          } catch (error) {
            console.error('[AudioPlayerPreview] Play error:', error)
            setAudioError('Failed to play audio')
            setIsPlaying(false)
          }
        }
      } else {
        // Пауза - останавливаем воспроизведение
        console.log('[AudioPlayerPreview] Pausing audio playback')
        setIsPlaying(false)

        if (audioRef) {
          try {
            audioRef.pause()
            console.log('[AudioPlayerPreview] Audio paused successfully')
          } catch (error) {
            console.error('[AudioPlayerPreview] Pause error:', error)
            setAudioError('Failed to pause audio')
          }
        }

        // Также приостанавливаем AudioContext если нужно
        if (audioContextRef?.state === 'running') {
          try {
            await audioContextRef.suspend()
            console.log('[AudioPlayerPreview] AudioContext suspended')
          } catch (error) {
            console.error('[AudioPlayerPreview] AudioContext suspend error:', error)
          }
        }
      }
    } catch (error) {
      console.error('[AudioPlayerPreview] handlePlayMedia error:', error)
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
    // Не обновляем время во время перемотки
    if (!isSeeking()) {
      setCurrentTime(audioRef?.currentTime || 0)
    }
  }

  const handleAudioError = (event: Event) => {
    console.error('[AudioPlayerPreview] Audio error:', event)
    const audioElement = event.target as HTMLAudioElement
    const currentSrc = audioElement.src

    // Если ошибка с квотером, попробуем оригинальный URL
    if (currentSrc.includes('files.dscrs.site') && currentTack()?.url) {
      const originalUrl = currentTack()?.url
      if (originalUrl && !originalUrl.includes('files.dscrs.site')) {
        console.log('[AudioPlayerPreview] Retrying with original URL:', originalUrl)
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
    if (audioRef && audioContextRef && gainNodeRef) {
      try {
        // Проверяем, не подключен ли уже
        if (audioRef.srcObject) {
          console.log('[AudioPlayerPreview] AudioContext already connected')
          return
        }

        const track = audioContextRef.createMediaElementSource(audioRef)
        track.connect(gainNodeRef).connect(audioContextRef.destination)
        console.log('[AudioPlayerPreview] AudioContext connected successfully')
      } catch (error) {
        console.error('[AudioPlayerPreview] AudioContext connection error:', error)
        setAudioError('Audio context error')
      }
    }
  })

  onMount(() => {
    try {
      audioContextRef = new AudioContext()
      gainNodeRef = audioContextRef.createGain()
      console.log('[AudioPlayerPreview] AudioContext initialized')

      // Принудительно подключаем AudioContext после небольшой задержки
      setTimeout(() => {
        if (audioRef && audioContextRef && gainNodeRef) {
          try {
            const track = audioContextRef.createMediaElementSource(audioRef)
            track.connect(gainNodeRef).connect(audioContextRef.destination)
            console.log('[AudioPlayerPreview] AudioContext connected in onMount timeout')
          } catch (error) {
            console.error('[AudioPlayerPreview] AudioContext connection error in onMount:', error)
            setAudioError('Audio context connection failed')
          }
        }
      }, 100)
    } catch (error) {
      console.error('[AudioPlayerPreview] AudioContext initialization error:', error)
      setAudioError('Audio context initialization failed')
    }
  })

  const playPrevTrack = () => {
    let newCurrentTrackIndex = currentTrackIndex() - 1
    if (newCurrentTrackIndex < 0) {
      newCurrentTrackIndex = 0
    }

    console.log('[AudioPlayerPreview] playPrevTrack:', {
      from: currentTrackIndex(),
      to: newCurrentTrackIndex
    })

    // Сбрасываем время и останавливаем воспроизведение при смене трека
    setCurrentTime(0)
    setIsPlaying(false)
    setCurrentTrackIndex(newCurrentTrackIndex)
  }

  const playNextTrack = () => {
    let newCurrentTrackIndex = currentTrackIndex() + 1
    if (newCurrentTrackIndex > props.media.length - 1) {
      newCurrentTrackIndex = props.media.length - 1
    }

    console.log('[AudioPlayerPreview] playNextTrack:', {
      from: currentTrackIndex(),
      to: newCurrentTrackIndex
    })

    // Сбрасываем время и останавливаем воспроизведение при смене трека
    setCurrentTime(0)
    setIsPlaying(false)
    setCurrentTrackIndex(newCurrentTrackIndex)
  }

  /**
   * Обрабатывает перемотку аудио при взаимодействии с прогресс-баром
   * @param event Событие мыши
   */
  const scrub = async (event: MouseEvent | undefined) => {
    if (!event || !audioRef) {
      console.warn('[AudioPlayerPreview] scrub: missing event or audioRef')
      return
    }

    const progressElement = event.currentTarget as HTMLDivElement
    const offsetX = event.offsetX
    const width = progressElement.offsetWidth
    const duration = currentTrackDuration()

    // Проверяем валидность данных
    if (width <= 0) {
      console.warn('[AudioPlayerPreview] scrub: invalid width:', width)
      return
    }

    if (duration <= 0) {
      console.warn('[AudioPlayerPreview] scrub: invalid duration:', duration)
      return
    }

    // Вычисляем новую позицию с ограничениями
    const newTime = Math.max(0, Math.min((offsetX / width) * duration, duration))

    console.log('[AudioPlayerPreview] scrub:', {
      offsetX,
      width,
      duration,
      newTime,
      currentTime: audioRef.currentTime,
      wasPlaying: !audioRef.paused
    })

    // Запоминаем состояние воспроизведения
    const wasPlaying = !audioRef.paused

    try {
      // Устанавливаем флаг перемотки
      setIsSeeking(true)
      console.log('[AudioPlayerPreview] scrub: seeking started')

      // Приостанавливаем воспроизведение для надежной перемотки
      if (wasPlaying) {
        audioRef.pause()
        console.log('[AudioPlayerPreview] scrub: paused for seeking')
      }

      // Устанавливаем новую позицию
      audioRef.currentTime = newTime
      console.log('[AudioPlayerPreview] scrub: time set to', newTime)

      // Обновляем отображаемое время сразу
      setCurrentTime(newTime)

      // Ждем небольшую задержку для применения изменений
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Возобновляем воспроизведение если было активно
      if (wasPlaying) {
        try {
          await audioRef.play()
          console.log('[AudioPlayerPreview] scrub: resumed playback')
        } catch (error) {
          console.error('[AudioPlayerPreview] scrub: failed to resume playback:', error)
          setIsPlaying(false)
        }
      }

      // Снимаем флаг перемотки
      setIsSeeking(false)
      console.log('[AudioPlayerPreview] scrub: seeking completed, new time:', audioRef.currentTime)
    } catch (error) {
      console.error('[AudioPlayerPreview] scrub: failed to set currentTime:', error)
      setIsSeeking(false)
    }
  }

  // Диагностика медиа данных
  createEffect(() => {
    const media = props.media
    const currentTrack = currentTack()

    console.log('[AudioPlayerPreview] Media data:', {
      mediaLength: media?.length,
      currentTrackIndex: currentTrackIndex(),
      currentTrack: currentTrack,
      currentTrackUrl: currentTrack?.url,
      mediaUrls: media?.map((m) => m.url)
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
          <div style={{ color: 'red', padding: '10px', 'text-align': 'center' }}>Error: {audioError()}</div>
        </Show>

        <audio
          ref={(el) => (audioRef = el)}
          onTimeUpdate={handleAudioTimeUpdate}
          onLoadStart={handleAudioLoadStart}
          src={getCdnUrl(currentTack()?.url || '')}
          onCanPlay={() => {
            // start to play the next track on src change
            if (isPlaying() && audioRef) {
              audioRef.play().catch((error) => {
                console.error('[AudioPlayerPreview] Auto-play error:', error)
                setAudioError('Auto-play failed')
                setIsPlaying(false)
              })
            }
          }}
          onLoadedMetadata={({ currentTarget }) => {
            const duration = currentTarget.duration
            console.log('[AudioPlayerPreview] Metadata loaded:', {
              duration,
              isValid: duration > 0,
              currentTime: currentTarget.currentTime,
              readyState: currentTarget.readyState,
              trackIndex: currentTrackIndex(),
              trackUrl: currentTack()?.url
            })

            if (duration > 0) {
              setCurrentTrackDuration(duration)
              console.log('[AudioPlayerPreview] Duration set to:', duration)
            } else {
              console.warn('[AudioPlayerPreview] Invalid duration received:', duration)
            }
          }}
          onEnded={handleAudioEnd}
          onError={handleAudioError}
          crossorigin="anonymous"
          preload="metadata"
        />
      </Show>
    </div>
  )
}
