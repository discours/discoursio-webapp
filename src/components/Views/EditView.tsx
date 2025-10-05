import { clsx } from 'clsx'
import { batch, createEffect, createSignal, on, onCleanup, onMount, Show, untrack } from 'solid-js'
import { NoHydration } from 'solid-js/web'
import toast from 'solid-toast'
import { debounce } from 'throttle-debounce'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Modal } from '~/components/_shared/Modal'
import { EditorSwiper } from '~/components/_shared/SolidSwiper'
import { Panel } from '~/components/Sidebar/Sidebar'
// Импортируем функцию для сохранения поля черновика
import { saveDraftField as saveDraftFieldToStorage } from '~/components/SimpleRichEditor/lib/storage'
import { ExtendedDraft, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import type { Draft, DraftInput, MediaItem, Topic } from '~/graphql/generated/graphql'
import { slugify } from '~/intl/translit'
import styles from '~/styles/views/EditView.module.scss'
import { UploadedFile } from '~/types/upload'
import { type SSEMessage, useConnect } from '../../context/connect'
import { VideoPreview } from '../_shared/VideoPreview'
import { AudioProfile } from '../Draft/DraftAudio'
import { SubtitleComponent, TitleSection } from '../Draft/DraftEditorHead'
import { LeadComponent } from '../Draft/DraftEditorLead'
import { isEmptyContent } from '../SimpleRichEditor/lib/empty'
import { CommandType, EditorData } from '../SimpleRichEditor/lib/types'
import { SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
import { AudioUploader } from '../Upload/AudioUploader'
import { UploadModalContent } from '../Upload/UploadModalContent'
import { VideoUploader } from '../Upload/VideoUploader'

export const EMPTY_TOPIC: Topic = {
  id: -1,
  slug: ''
}

export const featuredEditorCommands = [
  // Дропдаун "TT"
  [
    ['h1', 'h2', 'h3'], // Первая группа (Заголовки)
    ['blockquote', 'punchline', 'squib'] // Вторая группа (Выделение)
  ],
  '',
  // Простые кнопки
  'bold',
  'italic',
  'highlight',
  '',
  'link',
  'tooltip', // иконка снежинки
  '',
  // Дропдаун "Списки"
  [
    // Массив => Дропдаун
    ['bulletList', 'orderedList'] // Первая группа (Списки)
  ]
]

/**
 * Компонент для редактирования черновика
 *
 * @param props Свойства компонента
 * @returns React компонент
 */
export const EditView = (props: { draft?: Draft }) => {
  const { t } = useLocalize()
  const {
    currentDraft,
    setCurrentDraft,
    updateDraftField,
    getEditorContent,
    setEditorContent,
    syncDraft,
    validationErrors,
    validateCurrentDraft,
    clearValidationErrors,
    updateDraft
  } = useDrafts()

  // Инициализируем useConnect на верхнем уровне компонента
  const { getStatus, reconnect, connect, connectEditor, addHandler } = useConnect()

  // Инициализируем useUI на верхнем уровне для доступа к modalCallbacks
  const { modalCallbacks } = useUI()

  // Базовые сигналы
  const [subtitleInput, setSubtitleInput] = createSignal<HTMLTextAreaElement>()
  const [isSubtitleVisible, setIsSubtitleVisible] = createSignal(false)
  const [isLeadVisible, setIsLeadVisible] = createSignal(false)
  const [mediaItems, setMediaItems] = createSignal<MediaItem[]>([])
  const [bodyEditorRef, setBodyEditorRef] = createSignal<HTMLDivElement>()
  const [leadEditorRef, setLeadEditorRef] = createSignal<HTMLDivElement>()
  const [isBodyEditorFocused, setIsBodyEditorFocused] = createSignal(false)
  const [isTitleClicked, setIsTitleClicked] = createSignal(false)
  const [originalLeadContent, setOriginalLeadContent] = createSignal('')
  const [isScrolled, setIsScrolled] = createSignal(false)
  const [awarenessUnsubscribe, setAwarenessUnsubscribe] = createSignal<(() => void) | null>(null)
  const [baseAudioFields, setBaseAudioFields] = createSignal({
    artist: '',
    date: '',
    genre: ''
  })

  // Флаг для блокировки внешних обновлений во время ввода
  let isUserTyping = false
  let userTypingTimer: ReturnType<typeof setTimeout> | null = null

  // Дебаунсированные функции
  const debouncedValidate = debounce(1000, () => {
    validateCurrentDraft()
  })

  const debouncedUpdateSlug = debounce(300, (draftId: number, title: string) => {
    updateDraftField(draftId, 'slug', slugify(title), false)
    debouncedValidate()
  })

  const debouncedUpdateFromAwareness = debounce(300, (updates: Partial<Draft>) => {
    if (isUserTyping) {
      setTimeout(() => debouncedUpdateFromAwareness(updates), 500)
      return
    }

    setCurrentDraft({ ...(currentDraft() || {}), ...updates } as ExtendedDraft)
  })

  // Блокировка внешних обновлений на время ввода - переработано полностью
  const blockExternalUpdates = (duration = 5000) => {
    if (userTypingTimer) {
      clearTimeout(userTypingTimer)
    }

    isUserTyping = true

    userTypingTimer = setTimeout(() => {
      isUserTyping = false
    }, duration)
  }

  // Проверка, находится ли фокус в редакторе
  const isEditorFocused = () => {
    const activeElement = document.activeElement
    const bodyEditor = bodyEditorRef()
    const leadEditor = leadEditorRef()

    return (
      activeElement === bodyEditor ||
      activeElement === leadEditor ||
      activeElement?.classList.contains('titleInput') ||
      activeElement?.classList.contains('subtitleInput') ||
      activeElement?.closest('[contenteditable="true"]') !== null ||
      activeElement?.tagName === 'INPUT'
    )
  }

  // Основные обработчики событий (определены ДО onMount, где используются)
  const handleScroll = () => setIsScrolled(window.scrollY > 0)

  const handleNetworkStatusChange = () => {
    const draftId = currentDraft()?.id

    if (typeof window !== 'undefined' && navigator.onLine && draftId) {
      // Синхронизация с сервером при восстановлении соединения
      syncDraft(draftId)
        .then(() => {
          const draft = currentDraft()
          if (draft && getStatus() !== 'connected') {
            // Переподключаемся к SSE
            reconnect().catch((error) => {
              console.error('[EditView] Failed to reconnect SSE after network change:', error)
            })
          }
        })
        .catch((error) => {
          console.error('[EditView] Failed to sync draft after network change:', error)
        })
    } else if (typeof window !== 'undefined' && !navigator.onLine) {
      // Если сеть отключена, показываем уведомление и продолжаем работу офлайн
      console.warn('[EditView] Network is offline, continuing in offline mode')
    }
  }

  // Инициализация компонента
  onMount(async () => {
    clearValidationErrors()

    // Слушатели событий
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('online', handleNetworkStatusChange)
    window.addEventListener('offline', handleNetworkStatusChange)

    if (props.draft?.id) {
      setCurrentDraft(props.draft as ExtendedDraft)
      await syncDraft(props.draft.id)

      const draft = currentDraft()
      if (draft) {
        setIsLeadVisible(false)
        setIsSubtitleVisible(Boolean(draft.subtitle))

        // Распарсим строковое представление media если оно есть
        if (draft.media) {
          try {
            if (typeof draft.media === 'string') {
              const parsedMedia = JSON.parse(draft.media)
              setMediaItems(Array.isArray(parsedMedia) ? parsedMedia : [])
            } else {
              setMediaItems(draft.media as MediaItem[])
            }
          } catch (e) {
            console.error('[EditView] Failed to parse media data:', e)
            setMediaItems([])
          }
        } else {
          setMediaItems([])
        }

        // Инициализируем Awareness только после установки текущего черновика
        if (typeof window !== 'undefined' && navigator.onLine) {
          try {
            initializeAwareness(draft)
          } catch (error) {
            console.error('[EditView] Failed to initialize awareness:', error)
          }
        }
      }
    }
  })

  // Очистка при размонтировании
  onCleanup(() => {
    // Очистка таймеров и обработчиков
    if (userTypingTimer) {
      clearTimeout(userTypingTimer)
    }

    // Удаляем слушатели событий ввода с редакторов
    const bodyEditor = bodyEditorRef()
    const leadEditor = leadEditorRef()

    if (bodyEditor) {
      bodyEditor.removeEventListener('input', handleEditorInput)
    }

    if (leadEditor) {
      leadEditor.removeEventListener('input', handleEditorInput)
    }

    // Отменяем дебаунсированные функции
    clearValidationErrors()
    debouncedValidate.cancel()
    debouncedUpdateFromAwareness.cancel()
    debouncedUpdateSlug.cancel()

    // Отписываемся от провайдера Awareness
    try {
      const unsubscribeFn = awarenessUnsubscribe()
      if (unsubscribeFn) {
        unsubscribeFn()
      }

      // Provider cleanup removed with awareness system simplification
    } catch (error) {
      console.error('[EditView] Error during awareness cleanup:', error)
    }

    // Удаляем слушатели событий (только в браузере)
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('online', handleNetworkStatusChange)
      window.removeEventListener('offline', handleNetworkStatusChange)
    }
  })

  // Эффекты
  createEffect(
    on(
      () => currentDraft()?.id,
      (newId, oldId) => {
        if (newId !== oldId) {
          clearValidationErrors()
        }
      }
    )
  )

  createEffect(
    on(currentDraft, (d?: Draft) => {
      if (!d) return

      batch(() => {
        setIsSubtitleVisible(Boolean(d.subtitle))

        // Распарсим строковое представление media если оно есть
        if (d.media) {
          try {
            if (typeof d.media === 'string') {
              const parsedMedia = JSON.parse(d.media)
              setMediaItems(Array.isArray(parsedMedia) ? parsedMedia : [])
            } else {
              setMediaItems(d.media as MediaItem[])
            }
          } catch (e) {
            console.error('[EditView] Error parsing media:', e)
            setMediaItems([])
          }
        } else {
          setMediaItems([])
        }
      })
    })
  )

  createEffect(() => {
    if (isBodyEditorFocused() && isLeadVisible()) {
      const draft = currentDraft()
      if (!draft?.id) return

      untrack(() => {
        const leadContent = getEditorContent(`draft-${draft.id}-lead`) || ''
        if (isEmptyContent(leadContent)) {
          cancelLead()
        } else {
          saveLead()
        }
      })
    }
  })

  const handleDocumentClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement

    const isInteractiveOrSpecialElement = Boolean(
      target.closest('button') ||
        target.closest('a') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select') ||
        target.closest('[role="button"]') ||
        target.closest('[contenteditable="true"]') ||
        target.closest('.interactive') ||
        target.closest('.titleInput') ||
        target.closest('[data-field-type="lead"]') ||
        target.closest(`.${styles.leadContentDisplay}`) ||
        target.closest(`.${styles.leadContentText}`) ||
        target.closest(`.${styles.headingActions}`) ||
        target.closest('[data-field-type="body"]') ||
        target.closest('.settingsControl') ||
        target.closest('button[value="ellipsis"]') ||
        target.closest('svg[data-icon="ellipsis"]') ||
        target.closest('.settingsControlContainer') ||
        target.tagName.toLowerCase() === 'button' ||
        target.tagName.toLowerCase() === 'a' ||
        target.tagName.toLowerCase() === 'input' ||
        target.tagName.toLowerCase() === 'textarea' ||
        target.tagName.toLowerCase() === 'select'
    )

    const isEmptyAreaClick = Boolean(
      !isInteractiveOrSpecialElement &&
        (target === document.body ||
          target === document.documentElement ||
          (target.tagName.toLowerCase() === 'div' && !target.getAttribute('contenteditable')))
    )

    const isTitleClick = target.closest('.titleInput') || target.closest('input[type="text"]')
    if (isTitleClick) {
      setIsTitleClicked(true)
    } else if (!target.closest(`.${styles.headingActions}`)) {
      setIsTitleClicked(false)
    }

    if (!isEmptyAreaClick || isLeadVisible()) {
      return
    }

    // Фокус на редакторе при клике в пустую область
    const bodyEditor = bodyEditorRef()
    if (bodyEditor) {
      bodyEditor.focus()

      const selection = window.getSelection()
      const range = document.createRange()

      if (selection && bodyEditor.childNodes.length > 0) {
        const lastChild = bodyEditor.lastChild
        if (lastChild) {
          if (lastChild.nodeType === Node.TEXT_NODE) {
            range.setStart(lastChild, lastChild.textContent?.length || 0)
          } else {
            range.selectNodeContents(lastChild)
            range.collapse(false)
          }
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    blockExternalUpdates()

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
    }
  }

  const handleEditorInput = () => {
    blockExternalUpdates()
  }

  // Обработка изменений полей
  const handleInputChange = (key: keyof DraftInput, val: string | EditorData) => {
    if (isEditorFocused()) {
      blockExternalUpdates()
    }

    const draft = currentDraft()
    if (!draft?.id) return

    try {
      batch(() => {
        updateDraftField(draft.id, key, val, typeof val === 'object')

        if (key === 'title' && typeof val === 'string') {
          debouncedUpdateSlug(draft.id, val)
        }
      })
    } catch (error) {
      console.error(`[EditView] Error updating field ${key}:`, error)
    }
  }

  const handleTitleInputChange = (value: string) => {
    if (isEditorFocused()) {
      blockExternalUpdates()
    }

    const draft = currentDraft()
    if (!draft?.id) return

    batch(() => {
      updateDraftField(draft.id, 'title', value, false)
      debouncedUpdateSlug(draft.id, value)
    })
  }

  // Обработка медиа - полностью переписано для защиты от многократной сериализации
  const handleAddMedia = (data: MediaItem[]) => {
    if (!Array.isArray(data) || !data.length) {
      console.warn('[EditView] Invalid media data received', data)
      return
    }

    const draft = currentDraft()
    if (!draft?.id) return

    if (isEditorFocused()) {
      blockExternalUpdates()
    }

    try {
      untrack(() => {
        batch(() => {
          // Получаем существующие медиа и объединяем с новыми
          const existingMedia = [...mediaItems()]
          const newMedia = [...existingMedia, ...data]

          // Обновляем локальное состояние и поле черновика атомарно
          setMediaItems(newMedia)
          updateDraftField(draft.id, 'media', JSON.stringify(newMedia), false)
        })
      })
    } catch (error) {
      console.error('[EditView] Error adding media:', error)
    }
  }

  const handleSortedMedia = (data: MediaItem[]) => {
    if (!Array.isArray(data)) {
      console.warn('[EditView] Invalid sorted media data', data)
      return
    }

    const draft = currentDraft()
    if (!draft?.id) return

    if (isEditorFocused()) {
      blockExternalUpdates()
    }

    try {
      untrack(() => {
        batch(() => {
          setMediaItems(data)
          updateDraftField(draft.id, 'media', JSON.stringify(data), false)
        })
      })
    } catch (error) {
      console.error('[EditView] Error sorting media:', error)
    }
  }

  const handleMediaDelete = (index: number) => {
    const media = mediaItems()
    if (!Array.isArray(media) || index < 0 || index >= media.length) {
      console.warn('[EditView] Invalid media index for deletion', index)
      return
    }

    const draft = currentDraft()
    if (!draft?.id) return

    if (isEditorFocused()) {
      blockExternalUpdates()
    }

    try {
      untrack(() => {
        batch(() => {
          const updatedMedia = [...media]
          updatedMedia.splice(index, 1)
          setMediaItems(updatedMedia)
          updateDraftField(draft.id, 'media', JSON.stringify(updatedMedia), false)
        })
      })
    } catch (error) {
      console.error('[EditView] Error deleting media:', error)
    }
  }

  const handleMediaChange = (index: number, value: MediaItem) => {
    const media = mediaItems()
    if (!Array.isArray(media) || index < 0 || index >= media.length) {
      console.warn('[EditView] Invalid media index for update', index)
      return
    }

    if (!value || typeof value !== 'object') {
      console.warn('[EditView] Invalid media value for update', value)
      return
    }

    const draft = currentDraft()
    if (!draft?.id) return

    if (isEditorFocused()) {
      blockExternalUpdates()
    }

    try {
      untrack(() => {
        batch(() => {
          const updatedMedia = media.map((item, idx) => (idx === index ? value : item))
          setMediaItems(updatedMedia)
          updateDraftField(draft.id, 'media', JSON.stringify(updatedMedia), false)
        })
      })
    } catch (error) {
      console.error('[EditView] Error updating media:', error)
    }
  }

  const handleBaseFieldsChange = (key: string, value: string) => {
    if (isEditorFocused()) {
      blockExternalUpdates()
    }

    try {
      untrack(() => {
        batch(() => {
          const media = mediaItems()
          if (Array.isArray(media) && media.length > 0) {
            const updated = media.map((item) => ({ ...item, [key]: value }))
            const draft = currentDraft()
            if (!draft?.id) return

            setMediaItems(updated)
            updateDraftField(draft.id, 'media', JSON.stringify(updated), false)
          } else {
            setBaseAudioFields((prev) => ({ ...prev, [key]: value }))
          }
        })
      })
    } catch (error) {
      console.error('[EditView] Error updating base fields:', error)
    }
  }

  // Работа с лидом и подзаголовком
  const showSubtitleInput = () => {
    setIsSubtitleVisible(true)

    setTimeout(() => {
      const input = subtitleInput()
      if (input) {
        input.focus()
      }
    }, 100)
  }

  const showLeadInput = () => {
    setIsBodyEditorFocused(false)

    const draft = currentDraft()
    if (!draft?.id) return
    const draftId = draft.id

    // Получаем текущее содержимое лида
    const storedLead = getEditorContent(`draft-${draftId}-lead`)
    const currentLead = storedLead || draft?.lead || ''
    setOriginalLeadContent(currentLead)

    // Сохраняем в контексте
    setEditorContent(`draft-${draftId}-lead`, currentLead)

    // После установки контента показываем редактор
    setIsLeadVisible(true)

    setTimeout(() => {
      const editorElement = leadEditorRef()
      if (editorElement) {
        try {
          editorElement.focus()
        } catch (e) {
          console.error('[EditView] Error focusing lead editor:', e)
        }
      }
    }, 100)
  }

  const saveLead = () => {
    if (isEditorFocused()) {
      blockExternalUpdates()
    }

    const draft = currentDraft()
    if (!draft?.id) return
    const draftId = draft.id
    const editorId = `draft-${draftId}-lead`

    try {
      batch(() => {
        const leadContent = getEditorContent(editorId) || ''

        if (isEmptyContent(leadContent)) {
          cancelLead()
          return
        }

        updateDraftField(draftId, 'lead', leadContent, true)
        setIsLeadVisible(false)
      })
    } catch (error) {
      console.error('[EditView] Error saving lead:', error)
    }
  }

  const cancelLead = () => {
    if (isEditorFocused()) {
      blockExternalUpdates()
    }

    const draft = currentDraft()
    if (!draft?.id) return

    batch(() => {
      // Восстанавливаем исходное содержимое лида
      updateDraftField(draft.id, 'lead', originalLeadContent(), true)
      setIsLeadVisible(false)
    })
  }

  const handleLeadEditorChange = (data: EditorData) => {
    if (isEditorFocused()) {
      blockExternalUpdates(4000)
    }

    const draft = currentDraft()
    if (!draft?.id) return

    try {
      if (!data || typeof data !== 'object' || !('content' in data)) {
        console.error('[EditView] Invalid lead editor data:', data)
        return
      }

      untrack(() => {
        updateDraftField(draft.id, 'lead', data, true)
      })
    } catch (error) {
      console.error('[EditView] Error updating lead editor:', error)
    }
  }

  const handleBodyEditorFocus = (isFocused: boolean) => {
    batch(() => {
      setIsBodyEditorFocused(isFocused)

      if (isFocused && isLeadVisible()) {
        const activeElement = document.activeElement
        const leadEditor = leadEditorRef()

        if (leadEditor && (activeElement === leadEditor || leadEditor.contains(activeElement))) {
          return
        }

        setTimeout(() => {
          if (!isLeadVisible()) return

          const draft = currentDraft()
          if (!draft?.id) return

          untrack(() => {
            const leadContent = getEditorContent(`draft-${draft.id}-lead`)

            if (!leadContent || isEmptyContent(leadContent)) {
              cancelLead()
            } else {
              saveLead()
            }

            setIsLeadVisible(false)
          })
        }, 50)
      }
    })
  }

  // Работа с Awareness - упрощено, использует новый SSE API
  const initializeAwareness = (draft: Draft) => {
    try {
      // Отписываемся от предыдущего провайдера, если он был
      const unsubscribeFn = awarenessUnsubscribe()
      if (unsubscribeFn) {
        unsubscribeFn()
        setAwarenessUnsubscribe(null)
      }

      const editorId = `draft-${draft.id}`

      // Подключаем редактор к awareness
      connectEditor(editorId, draft.id)

      // Устанавливаем обработчик SSE сообщений
      const unsubscribe = addHandler((message: SSEMessage) => {
        console.log('[EditView] Получено SSE сообщение:', message)
        // Обрабатываем только сообщения, связанные с черновиками
        if (message.entity === 'draft' && message.payload) {
          handleAwarenessUpdates({ added: [], updated: [1], removed: [] })
        }
      })

      setAwarenessUnsubscribe(() => unsubscribe)

      // Проверяем статус соединения
      if (getStatus() !== 'connected') {
        console.log('[EditView] SSE не подключен, пытаемся подключиться')
        connect().catch((error) => {
          console.error('[EditView] Ошибка подключения SSE:', error)
        })
      }
    } catch (error) {
      console.error('[EditView] Failed to connect to awareness:', error)
    }
  }

  // Полностью переработанная обработка awareness-обновлений
  const handleAwarenessUpdates = (_params: { added: number[]; updated: number[]; removed: number[] }) => {
    // Если фокус в любом из полей ввода - блокируем внешние обновления полностью
    if (isUserTyping || isEditorFocused()) {
      return
    }

    const draftId = currentDraft()?.id
    if (!draftId) return

    const connectContext = useConnect()
    if (connectContext.getStatus() !== 'connected') return

    try {
      untrack(() => {
        const draftFields = connectContext.getDraftContent(draftId)

        if (!draftFields || Object.keys(draftFields).length === 0) {
          return
        }

        const updates: Partial<Draft> = {}
        let needsUpdate = false

        Object.entries(draftFields).forEach(([fieldName, fieldData]) => {
          if (!currentDraft() || !(fieldName in currentDraft()!) || fieldName === 'id' || !fieldData.content) {
            return
          }

          const contentToSet = fieldData.content

          // Особая обработка для media
          if (fieldName === 'media' && typeof contentToSet === 'string') {
            try {
              const parsedMedia = JSON.parse(contentToSet)
              if (Array.isArray(parsedMedia)) {
                const currentMediaJson = JSON.stringify(mediaItems())
                if (currentMediaJson !== contentToSet) {
                  batch(() => {
                    setMediaItems(parsedMedia)
                    needsUpdate = true
                    // biome-ignore lint/suspicious/noExplicitAny: ok
                    updates[fieldName as keyof Draft] = parsedMedia as any
                  })
                }
              }
            } catch (e) {
              console.error('[EditView] Failed to parse media data from awareness:', e)
            }
          }
          // Для редакторских полей (тело, лид)
          else if (fieldName === 'body' || fieldName === 'lead') {
            const editorId = `draft-${draftId}-${fieldName}`
            const currentContent = getEditorContent(editorId)

            if (currentContent !== contentToSet) {
              batch(() => {
                setEditorContent(editorId, contentToSet)
                needsUpdate = true
                // biome-ignore lint/suspicious/noExplicitAny: ok
                updates[fieldName as keyof Draft] = contentToSet as any
              })
            }
          }
          // Для всех остальных полей
          else {
            const currentValue = currentDraft()![fieldName as keyof Draft]
            if (currentValue !== contentToSet) {
              needsUpdate = true
              // biome-ignore lint/suspicious/noExplicitAny: ok
              updates[fieldName as keyof Draft] = contentToSet as any
            }
          }
        })

        // Если есть изменения - обновляем черновик
        if (needsUpdate && Object.keys(updates).length > 0) {
          batch(() => {
            setCurrentDraft({
              ...currentDraft()!,
              ...updates
            } as ExtendedDraft)
          })
        }
      })
    } catch (error) {
      console.error('[EditView] Error processing awareness updates:', error)
    }
  }

  // Добавляем функцию для сохранения черновика
  const _handleSaveDraft = async () => {
    if (!currentDraft()?.id) {
      toast.error(t('No draft to save'))
      return
    }

    console.log(`[EditView] Сохраняем черновик #${currentDraft()?.id} на сервер`)
    setIsSaving(true)

    try {
      // Получаем текущий черновик
      const draft = currentDraft()
      if (!draft) {
        throw new Error('No current draft available')
      }

      // Создаем объект для обновления с текущими данными
      const draftInput: DraftInput = {
        id: draft.id,
        layout: draft.layout || 'article',
        title: draft.title || '',
        subtitle: draft.subtitle || '',
        lead: draft.lead || '',
        body: draft.body || '',
        slug: draft.slug || '',
        cover: draft.cover || '',
        cover_caption: draft.cover_caption || '',
        topic_ids: Array.isArray(draft.topics)
          ? draft.topics.filter((topic): topic is Topic => Boolean(topic?.id)).map((topic) => topic.id)
          : [],
        main_topic_id: draft.topics && draft.topics.length > 0 && draft.topics[0] ? draft.topics[0].id : null,
        seo: draft.seo || '',
        author_ids: draft.authors?.map((a) => a?.id).filter((id): id is number => !!id) || []
      }

      // Логируем данные, которые будем сохранять
      console.log(`[EditView] Данные для сохранения черновика #${draft.id}:`, {
        title: draftInput.title?.substring(0, 30) + (draftInput.title && draftInput.title.length > 30 ? '...' : ''),
        bodyLength: draftInput.body?.length || 0,
        leadLength: draftInput.lead?.length || 0,
        topicsCount: draftInput.topic_ids?.length || 0
      })

      // Получаем актуальные данные из Connect context если соединение активно
      try {
        const connectContext = useConnect()
        if (connectContext.getStatus() === 'connected') {
          console.log('[EditView] Получаем данные из ConnectProvider для синхронизации')

          const draftFields = connectContext.getDraftContent(draft.id)

          if (draftFields && Object.keys(draftFields).length > 0) {
            console.log('[EditView] Найдены данные в Connect для черновика:', Object.keys(draftFields))

            // Обновляем поля из connect context
            Object.entries(draftFields).forEach(([fieldName, fieldData]) => {
              type FieldData = { content?: string }
              const fd = fieldData as unknown as FieldData
              if (fieldName in draftInput && fd?.content) {
                console.log(`[EditView] Обновляем поле ${fieldName} из connect (${fd.content.length} символов)`)
                // @ts-expect-error - мы проверили что поле существует выше
                draftInput[fieldName] = fd.content
              }
            })
          }
        }
      } catch (connectError) {
        console.error('[EditView] Ошибка при получении данных из ConnectProvider:', connectError)
        // Продолжаем сохранять даже при отсутствии/ошибке ConnectProvider
      }

      // Сохраняем на сервер
      const result = await updateDraft(draftInput)
      if (!result) {
        throw new Error('Failed to update draft - no result returned')
      }

      // Обрабатываем результат
      if (result.data?.update_draft?.draft) {
        toast.success(t('Draft saved successfully'))
        console.log('[EditView] Черновик успешно сохранен на сервер')

        // Сохраняем метку времени синхронизации в localStorage
        if (draft.id) {
          try {
            // Используем saveDraftFieldToStorage для сохранения метки синхронизации
            const syncTimestamp = Date.now()
            saveDraftFieldToStorage(draft.id, '_lastSync', syncTimestamp.toString())
            console.log(`[EditView] Сохранена метка синхронизации: ${syncTimestamp}`)
          } catch (storageError) {
            console.error('[EditView] Ошибка при сохранении метки синхронизации:', storageError)
          }
        }

        // Обновляем текущий черновик в контексте
        setCurrentDraft(result.data.update_draft.draft as ExtendedDraft)
      } else {
        let errorMessage = 'Server error'
        if (result.data?.update_draft?.error) {
          errorMessage = result.data.update_draft.error
        } else if (result.error?.message) {
          errorMessage = result.error.message
        }
        toast.error(`${t('Error saving draft')}: ${errorMessage}`)
      }
    } catch (error) {
      console.error('[EditView] Ошибка при сохранении черновика:', error)
      toast.error(`${t('Error saving draft')}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Функция восстановления контента из localStorage
  const _handleRestoreFromStorage = async () => {
    const draft = currentDraft()
    if (!draft?.id) {
      toast.error(t('No draft to restore'))
      return
    }

    try {
      console.log(`[EditView] Восстанавливаем черновик #${draft.id} из localStorage`)
      const restored = await syncDraft(draft.id)
      if (restored) {
        toast.success(t('Content restored from local storage'))
        console.log('[EditView] Контент восстановлен из localStorage:', restored.title)
      } else {
        toast.custom(t('No changes found in local storage'))
      }
    } catch (error) {
      console.error('[EditView] Ошибка при восстановлении:', error)
      toast.error(t('Error restoring content'))
    }
  }

  // Добавляем состояние для отслеживания процесса сохранения
  const [_isSaving, setIsSaving] = createSignal(false)

  // Состояние для URL видео в модальном окне
  const [_videoPreviewUrl, _setVideoPreviewUrl] = createSignal('')

  return (
    <>
      <div
        class={clsx(styles.editor, { [styles.audioEditor]: currentDraft()?.layout === 'audio' })}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onClick={handleDocumentClick}
      >
        <div class="wide-container">
          <div class="row">
            <div
              class={clsx('col-md-19 col-lg-18 col-xl-16 offset-md-5', {
                [styles.isScrolled]: isScrolled()
              })}
            >
              <Show when={currentDraft()}>
                <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
                  <TitleSection
                    draft={currentDraft()}
                    isTitleClicked={isTitleClicked()}
                    isSubtitleVisible={isSubtitleVisible()}
                    isLeadVisible={isLeadVisible()}
                    onTitleClick={() => setIsTitleClicked(true)}
                    onShowSubtitle={showSubtitleInput}
                    onShowLead={showLeadInput}
                    onTitleChange={handleTitleInputChange}
                    validationErrors={validationErrors()}
                  />

                  {/* Специальные компоненты для аудио */}
                  <Show when={currentDraft()?.layout === 'audio'}>
                    <AudioProfile
                      draft={currentDraft()}
                      mediaItems={mediaItems()}
                      onFieldChange={handleBaseFieldsChange}
                      onCoverChange={(url) => handleInputChange('cover', url)}
                    />
                  </Show>

                  {/* Подзаголовок */}
                  <Show when={currentDraft()?.layout !== 'audio'}>
                    <SubtitleComponent
                      draft={currentDraft()}
                      isVisible={isSubtitleVisible()}
                      onSubtitleChange={(value) => handleInputChange('subtitle', value)}
                      setSubtitleInput={setSubtitleInput}
                    />

                    {/* Лид */}
                    <LeadComponent
                      draft={currentDraft()}
                      isVisible={isLeadVisible()}
                      getEditorContent={getEditorContent}
                      setLeadEditorRef={setLeadEditorRef}
                      onLeadChange={handleLeadEditorChange}
                      onLeadSave={saveLead}
                      onShowLead={showLeadInput}
                      handleEditorInput={handleEditorInput}
                    />
                  </Show>

                  {/* Медиакомпоненты по типу лейаута */}
                  <Show when={currentDraft()?.layout === 'image'}>
                    <EditorSwiper
                      images={mediaItems()}
                      onImageChange={handleMediaChange}
                      onImageDelete={(index: number) => handleMediaDelete(index)}
                      onImagesAdd={(value: MediaItem[]) => handleAddMedia(value)}
                      onImagesSorted={(value: MediaItem[]) => handleSortedMedia(value)}
                    />
                  </Show>

                  <Show when={currentDraft()?.layout === 'video'}>
                    <VideoUploader
                      video={mediaItems()}
                      onVideoAdd={(data: MediaItem[]) => handleAddMedia(data)}
                      onVideoDelete={(index: number) => handleMediaDelete(index)}
                    />
                  </Show>

                  <Show when={currentDraft()?.layout === 'audio'}>
                    <AudioUploader
                      audio={mediaItems()}
                      baseFields={baseAudioFields()}
                      onAudioAdd={(value) => handleAddMedia(value)}
                      onAudioChange={handleMediaChange}
                      onAudioSorted={(value) => handleSortedMedia(value)}
                    />
                  </Show>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </div>

      <div class="wide-container">
        <div class="row">
          <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
            <div class={styles.mainEditorContainer}>
              {(() => {
                const draft = currentDraft()
                if (!draft?.id) return null

                return (
                  <NoHydration>
                    <SimpleRichEditor
                      editorId={`draft-${draft.id}-body`}
                      fieldType="body"
                      toolbar="float"
                      commands={featuredEditorCommands as readonly (CommandType | readonly CommandType[])[]}
                      content={getEditorContent(`draft-${draft.id}-body`) || draft.body || ''}
                      onChange={(data) => untrack(() => handleInputChange('body', data))}
                      onInit={(instance) => {
                        setBodyEditorRef(instance.editor)
                        if (instance.editor) {
                          instance.editor.addEventListener('input', handleEditorInput)
                        }
                      }}
                      onFocus={() => handleBodyEditorFocus(true)}
                      onBlur={() => handleBodyEditorFocus(false)}
                      plus={true}
                    />
                  </NoHydration>
                )
              })()}
            </div>
          </div>
        </div>
      </div>

      <Modal variant="medium" name="inviteCoauthors">
        <InviteMembers variant={'coauthors'} title={t('Invite experts')} />
      </Modal>

      {/* Глобальные модалы для SimpleRichEditor */}
      <Modal variant="narrow" name="uploadImage">
        <UploadModalContent
          onClose={(uploadedFile?: UploadedFile) => {
            const callbacks = modalCallbacks()
            if (callbacks?.onSuccess) {
              callbacks.onSuccess(uploadedFile)
            } else if (callbacks?.onCancel) {
              callbacks.onCancel()
            }
          }}
        />
      </Modal>

      <Modal variant="medium" name="uploadAudio">
        <AudioUploader
          audio={[]}
          onAudioAdd={(audioItems: MediaItem[]) => {
            const callbacks = modalCallbacks()
            if (callbacks?.onSuccess) {
              callbacks.onSuccess(audioItems)
            }
          }}
          onAudioChange={() => {}}
          onAudioSorted={() => {}}
        />
      </Modal>

      <Modal variant="medium" name="insertVideo">
        <VideoPreview
          videoUrl={(() => {
            return modalCallbacks()?.data?.videoUrl || ''
          })()}
          onSave={(url: string) => {
            const callbacks = modalCallbacks()
            if (callbacks?.onSuccess) {
              callbacks.onSuccess(url)
            }
          }}
          onDecline={() => {
            const callbacks = modalCallbacks()
            if (callbacks?.onCancel) {
              callbacks.onCancel()
            }
          }}
        />
      </Modal>

      <NoHydration>
        <Show when={currentDraft()?.id}>
          <Panel shoutId={currentDraft()?.id} />
        </Show>
      </NoHydration>
    </>
  )
}

export default EditView
