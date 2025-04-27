import { clsx } from 'clsx'
import { Show, createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
import { debounce } from 'throttle-debounce'

import { DropArea } from '~/components/_shared/DropArea'
import { Icon } from '~/components/_shared/Icon'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Modal } from '~/components/_shared/Modal'
import { Popover } from '~/components/_shared/Popover'
import { EditorSwiper } from '~/components/_shared/SolidSwiper'
import { useConnect } from '~/context/connect'
import { ExtendedDraft, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import type { Draft, DraftInput, MediaItem, Topic } from '~/graphql/schema/core.gen'
import { slugify } from '~/intl/translit'
import { getFileUrl } from '~/lib/getThumbUrl'
import { LayoutType } from '~/types/nav'
import { SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
import { getProvider } from '../SimpleRichEditor/lib/awareness'
import { isEmptyContent } from '../SimpleRichEditor/lib/empty'
import { CommandType, EditorData } from '../SimpleRichEditor/lib/types'
import { AudioUploader } from '../Upload/AudioUploader'
import { VideoUploader } from '../Upload/VideoUploader'
import GrowingTextarea from '../_shared/GrowingTextarea/GrowingTextarea'

import styles from '~/styles/views/EditView.module.scss'

export const MAX_HEADER_LIMIT = 100
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
  'footnote', // иконка снежинки
  '',
  // Дропдаун "Списки"
  [
    // Массив => Дропдаун
    ['bulletList', 'orderedList'] // Первая группа (Списки)
  ]
]

/**
 * EditView component
 *
 * @returns EditView component
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
    clearValidationErrors
  } = useDrafts()

  const [subtitleInput, setSubtitleInput] = createSignal<HTMLTextAreaElement | undefined>()
  const [isSubtitleVisible, setIsSubtitleVisible] = createSignal(false)
  const [isLeadVisible, setIsLeadVisible] = createSignal(false)
  const [mediaItems, setMediaItems] = createSignal<MediaItem[]>([])
  const [bodyEditorRef, setBodyEditorRef] = createSignal<HTMLDivElement>()
  const [isBodyEditorFocused, setIsBodyEditorFocused] = createSignal(false)
  const [isTitleClicked, setIsTitleClicked] = createSignal(false)
  const [originalLeadContent, setOriginalLeadContent] = createSignal('')
  const [leadEditorRef, setLeadEditorRef] = createSignal<HTMLDivElement>()

  const debouncedValidate = debounce(1000, () => {
    console.log('[EditView] Debounced validation triggered.')
    validateCurrentDraft()
  })

  onMount(async () => {
    clearValidationErrors()
    if (props.draft?.id) {
      setCurrentDraft(props.draft as Draft)
      await syncDraft(props.draft.id)
      console.log(`[EditView] Synced draft ${props.draft.id} on mount.`)

      const draft = currentDraft()
      if (draft) {
        setIsLeadVisible(false)
        setIsSubtitleVisible(Boolean(draft.subtitle))
        setMediaItems((draft.media || []) as MediaItem[])
      }

      if (navigator.onLine) {
        initializeAwareness(props.draft)
      } else {
        console.log('[EditView] Network is offline, working in offline mode')
      }
    } else {
      console.warn('[EditView] No draft passed via props or draft has no ID.')
    }

    document.addEventListener('click', handleDocumentClick)
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('online', handleNetworkStatusChange)
    window.addEventListener('offline', handleNetworkStatusChange)
    setNetworkStatus(navigator.onLine)
  })

  // Отдельная регистрация очистки для предотвращения перекрытия событий
  onCleanup(() => {
    clearValidationErrors()
    debouncedValidate.cancel()
    window.removeEventListener('scroll', handleScroll)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('click', handleDocumentClick)
    window.removeEventListener('online', handleNetworkStatusChange)
    window.removeEventListener('offline', handleNetworkStatusChange)
  })

  // Очищаем ошибки при смене черновика
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
      setIsSubtitleVisible(Boolean(d.subtitle))
      setMediaItems((d.media || []) as MediaItem[])

      // Проверяем заголовок и другие поля редактора
      console.log('[EditView] Current draft updated:', {
        title: d.title,
        subtitle: d.subtitle,
        lead: d.lead ? 'has lead content' : 'no lead content'
      })

      if (d.lead && !isLeadVisible()) {
        // setIsLeadVisible(false)
      }
    })
  )

  createEffect(() => {
    if (isBodyEditorFocused() && isLeadVisible()) {
      const draft = currentDraft()
      if (!draft?.id) return
      const leadContent = getEditorContent(`draft-${draft.id}-lead`) || ''
      if (isEmptyContent(leadContent)) {
        cancelLead()
      } else {
        saveLead()
      }
    }
  })

  createEffect(() => {
    if (isLeadVisible()) {
      setTimeout(() => {
        if (!isLeadVisible()) return

        const editorElement = leadEditorRef()
        if (editorElement) {
          if (document.activeElement !== editorElement) {
            const draft = currentDraft()
            if (!draft?.id) return
            const leadContent = getEditorContent(`draft-${draft.id}-lead`) || ''
            if (isEmptyContent(leadContent)) {
              editorElement.classList.add('placeholder-visible')
            } else {
              editorElement.classList.remove('placeholder-visible')
            }
            editorElement.focus()
            console.log('[EditView] Focused lead editor via effect')
          }
        }
      }, 200)
    }
  })

  const [isScrolled, setIsScrolled] = createSignal(false)
  const handleScroll = () => setIsScrolled(window.scrollY > 0)

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

    console.log('[EditView] Empty area click detected, focusing body editor')
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
          if (selection) {
            selection.removeAllRanges()
            selection.addRange(range)
          }
        }
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      console.log('[EditView] Ctrl+S pressed. Auto-save handled by context.')
    }
  }

  const handleInputChange = (key: keyof DraftInput, val: string | EditorData) => {
    const draft = currentDraft()
    if (!draft?.id) return

    const isEditorUpdate = typeof val === 'object' && val !== null && 'content' in val

    console.log(
      `[EditView] Updating draft field ${key}:`,
      typeof val === 'object' ? 'EditorData object' : val.substring(0, 50)
    )

    updateDraftField(draft.id, key, val, isEditorUpdate)

    if (key === 'title' && typeof val === 'string') {
      updateDraftField(draft.id, 'slug', slugify(val), false)
      debouncedValidate()
    }
  }

  const handleAwarenessUpdates = (_params: {
    added: number[]
    updated: number[]
    removed: number[]
  }) => {
    const draftId = currentDraft()?.id
    if (!draftId) return

    const awarenessProvider = getProvider()
    if (awarenessProvider.getConnectionState() !== 'connected') return

    const draftFields = awarenessProvider.getDraftContent(draftId)

    if (Object.keys(draftFields).length > 0) {
      let needsUpdate = false
      const updates: Partial<Draft> = {}

      Object.entries(draftFields).forEach(([fieldName, fieldData]) => {
        if (currentDraft() && fieldName in currentDraft()! && fieldName !== 'id' && fieldData.content) {
          const contentToSet = fieldData.content

          if (fieldName === 'body' || fieldName === 'lead') {
            setEditorContent(`draft-${draftId}-${fieldName}`, contentToSet)
          }

          if (currentDraft()![fieldName as keyof Draft] !== contentToSet) {
            // biome-ignore lint/suspicious/noExplicitAny: ok
            updates[fieldName as keyof Draft] = contentToSet as any
            needsUpdate = true
          }
        }
      })

      if (needsUpdate) {
        console.log('[EditView] Applying awareness updates to currentDraft', updates)
        setCurrentDraft({ ...(currentDraft() || {}), ...(updates || {}) } as ExtendedDraft)
      }
    }
  }

  const OfflineIndicator = () => {
    return (
      <Show when={!networkStatus()}>
        <div class={styles.offlineIndicator}>
          <Icon name="alert-triangle" />
          <span>{t('Offline mode: Changes will be saved when connection is restored')}</span>
        </div>
      </Show>
    )
  }

  const handleTitleInputChange = (value: string) => {
    handleInputChange('title', value)
    handleInputChange('slug', slugify(value))
  }

  const handleAddMedia = (data: MediaItem[]) => {
    const newMedia = [...mediaItems(), ...data]
    const draftId = currentDraft()?.id
    if (draftId) {
      updateDraftField(draftId, 'media', JSON.stringify(newMedia), false)
    }
  }
  const handleSortedMedia = (data: MediaItem[]) => {
    const draftId = currentDraft()?.id
    if (draftId) {
      updateDraftField(draftId, 'media', JSON.stringify(data), false)
    }
  }

  const handleMediaDelete = (index: number) => {
    const copy = [...mediaItems()]
    if (copy?.length > 0) copy.splice(index, 1)
    const draftId = currentDraft()?.id
    if (draftId) {
      updateDraftField(draftId, 'media', JSON.stringify(copy), false)
    }
  }

  const handleMediaChange = (index: number, value: MediaItem) => {
    const updated = mediaItems().map((item, idx) => (idx === index ? value : item))
    const draftId = currentDraft()?.id
    if (draftId) {
      updateDraftField(draftId, 'media', JSON.stringify(updated), false)
    }
  }

  const [baseAudioFields, setBaseAudioFields] = createSignal({
    artist: '',
    date: '',
    genre: ''
  })

  const handleBaseFieldsChange = (key: string, value: string) => {
    if (mediaItems().length > 0) {
      const updated = mediaItems().map((media) => ({ ...media, [key]: value }))
      handleInputChange('media', JSON.stringify(updated))
    } else {
      setBaseAudioFields({ ...baseAudioFields(), [key]: value })
    }
  }

  const articleTitle = () => {
    switch (currentDraft()?.layout as LayoutType) {
      case 'audio': {
        return t('Album name')
      }
      case 'image': {
        return t('Gallery name')
      }
      default: {
        return t('Header')
      }
    }
  }

  const showSubtitleInput = () => {
    setIsSubtitleVisible(true)
    console.log('[EditView] Showing subtitle input')

    setTimeout(() => {
      const input = subtitleInput()
      if (input) {
        input.focus()
        console.log('[EditView] Subtitle input focused')
      } else {
        console.warn('[EditView] Could not focus subtitle input - element not found')
      }
    }, 100)
  }

  const showLeadInput = () => {
    setIsBodyEditorFocused(false)

    const draft = currentDraft()
    if (!draft?.id) return
    const draftId = draft.id

    let currentLead = ''

    if (draftId) {
      // Сначала проверяем getEditorContent, затем draft.lead
      const storedLead = getEditorContent(`draft-${draftId}-lead`)
      currentLead = storedLead || draft?.lead || ''

      console.log('[EditView] showLeadInput extracting content:', {
        draftId,
        retrievedContent:
          typeof currentLead === 'string'
            ? currentLead.substring(0, 50)
            : JSON.stringify(currentLead).substring(0, 50)
      })
    }

    setOriginalLeadContent(currentLead)

    console.log('[EditView] showLeadInput', {
      draftId,
      currentLead:
        typeof currentLead === 'string'
          ? currentLead.substring(0, 50)
          : JSON.stringify(currentLead).substring(0, 50),
      isEmpty: isEmptyContent(currentLead)
    })

    // Сохраняем в контексте
    setEditorContent(`draft-${draftId}-lead`, currentLead)

    // После установки контента показываем редактор
    setIsLeadVisible(true)

    setTimeout(() => {
      const editorElement = leadEditorRef()
      if (editorElement) {
        try {
          editorElement.focus()
          console.log('[EditView] Lead editor focused successfully')
        } catch (e) {
          console.error('[EditView] Error focusing lead editor:', e)
        }
      } else {
        console.warn('[EditView] Could not focus lead editor - element not found')
      }
    }, 100)
  }

  const hideLeadInput = () => {
    setIsLeadVisible(false)
  }

  const saveLead = () => {
    const draft = currentDraft()
    if (!draft?.id) return
    const draftId = draft.id
    const editorId = `draft-${draftId}-lead`

    const leadContent = getEditorContent(editorId) || ''

    if (isEmptyContent(leadContent)) {
      cancelLead()
      return
    }

    console.log('[EditView] Saving lead content via context:', {
      draftId,
      contentLength: leadContent.length
    })

    updateDraftField(draftId, 'lead', leadContent, true)

    hideLeadInput()
  }

  const cancelLead = () => {
    const draft = currentDraft()
    if (!draft?.id) return
    const draftId = draft.id

    const originalContent = originalLeadContent()
    console.log('[EditView] Canceling lead edit, restoring original content via context:', {
      draftId,
      originalContent
    })

    updateDraftField(draftId, 'lead', originalContent, true)

    hideLeadInput()
  }

  const handleLeadEditorChange = (data: EditorData) => {
    const draft = currentDraft()
    if (!draft?.id) return
    const draftId = draft.id

    // Сохраняем контент без скрытия редактора
    updateDraftField(draftId, 'lead', data, true)

    // Фокусируем редактор снова после обновления контента
    setTimeout(() => {
      const editorElement = leadEditorRef()
      if (editorElement && isLeadVisible()) {
        editorElement.focus()
      }
    }, 10)
  }

  const handleBodyEditorFocus = (isFocused: boolean) => {
    setIsBodyEditorFocused(isFocused)

    // Проверяем, что фокус получен основным редактором, а не потерян редактором вступления
    if (isFocused && isLeadVisible()) {
      console.log('[EditView] Body editor focused while lead editor is visible, saving lead')

      // Проверяем, действительно ли фокус переместился в body-редактор
      // Это предотвратит срабатывание при нажатии клавиш в lead-редакторе
      const activeElement = document.activeElement
      const leadEditor = leadEditorRef()

      // Если активный элемент - редактор вступления или его потомок, не закрываем редактор
      if (leadEditor && (activeElement === leadEditor || leadEditor.contains(activeElement))) {
        console.log('[EditView] Lead editor still has focus, skipping auto-save')
        return
      }

      setTimeout(() => {
        if (!isLeadVisible()) return

        const draft = currentDraft()
        if (!draft?.id) return

        const leadContent = getEditorContent(`draft-${draft.id}-lead`)

        if (!leadContent || isEmptyContent(leadContent)) {
          cancelLead()
        } else {
          saveLead()
        }

        setIsLeadVisible(false)
      }, 50)
    }
  }

  const [networkStatus, setNetworkStatus] = createSignal(navigator.onLine)

  const handleNetworkStatusChange = () => {
    setNetworkStatus(navigator.onLine)
    const draftId = currentDraft()?.id

    if (navigator.onLine && draftId) {
      console.log('[EditView] Network is back online, attempting sync.')
      syncDraft(draftId)

      if (getProvider().getConnectionState() !== 'connected') {
        console.log('[EditView] Network is back online, connecting to awareness')
        const draft = currentDraft()
        if (draft) {
          initializeAwareness(draft)
        }
      }
    }
  }

  const initializeAwareness = (draft: Draft) => {
    try {
      const awarenessProvider = getProvider()
      const { addHandler } = useConnect()
      const editorId = `draft-${draft.id}`
      console.log('[EditView] Connecting to awareness for draft', draft.id)
      awarenessProvider['addHandler'] = addHandler
      awarenessProvider.connect(editorId)
      const unsubscribe = awarenessProvider.onAwarenessChange(handleAwarenessUpdates)
      console.log('[EditView] Connected to awareness for draft', draft.id)

      onCleanup(() => {
        unsubscribe()
        window.removeEventListener('scroll', handleScroll)
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('click', handleDocumentClick)
        window.removeEventListener('online', handleNetworkStatusChange)
        window.removeEventListener('offline', handleNetworkStatusChange)
      })
    } catch (error) {
      console.error('[EditView] Failed to connect to awareness:', error)
    }
  }

  return (
    <>
      <div
        class={clsx(styles.editor, { [styles.audioEditor]: currentDraft()?.layout === 'audio' })}
        onScroll={handleScroll}
      >
        <div class="wide-container">
          <div class="row">
            <div
              class={clsx('col-md-19 col-lg-18 col-xl-16 offset-md-5', {
                [styles.isScrolled]: isScrolled()
              })}
            >
              <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
                {(() => {
                  const draft = currentDraft()
                  if (!draft) return null

                  return (
                    <>
                      <OfflineIndicator />
                      <div class={styles.headingActions}>
                        <Show when={isTitleClicked() && !isSubtitleVisible() && draft.layout !== 'audio'}>
                          <a class={styles.action} onClick={showSubtitleInput}>
                            {t('Add subtitle')}
                          </a>
                        </Show>
                        <Show
                          when={
                            isTitleClicked() && !isLeadVisible() && !draft.lead && draft.layout !== 'audio'
                          }
                        >
                          <a class={styles.action} onClick={showLeadInput}>
                            {t('Add intro')}
                          </a>
                        </Show>
                      </div>
                      <div class={clsx({ [styles.audioHeader]: draft.layout === 'audio' })}>
                        <div class={styles.inputContainer}>
                          <GrowingTextarea
                            allowEnterKey={true}
                            onChange={(value) => handleTitleInputChange(value)}
                            class={styles.titleInput}
                            placeholder={articleTitle()}
                            initialValue={draft.title || ''}
                            maxLength={MAX_HEADER_LIMIT}
                            onClick={(e) => {
                              e.stopPropagation()
                              setIsTitleClicked(true)
                              console.log('[EditView] Title clicked')
                            }}
                          />

                          <Show when={validationErrors().title}>
                            <div class={styles.validationError}>{validationErrors().title}</div>
                          </Show>

                          <Show when={draft.layout === 'audio'}>
                            <div class={styles.additional}>
                              <input
                                type="text"
                                placeholder={t('Artist...')}
                                class={styles.additionalInput}
                                value={mediaItems()[0]?.artist || ''}
                                onChange={(event) => handleBaseFieldsChange('artist', event.target.value)}
                              />
                              <input
                                type="number"
                                min="1900"
                                max={new Date().getFullYear()}
                                step="1"
                                class={styles.additionalInput}
                                placeholder={t('Release date...')}
                                value={mediaItems()[0]?.date || ''}
                                onChange={(event) => handleBaseFieldsChange('date', event.target.value)}
                              />
                              <input
                                type="text"
                                placeholder={t('Genre...')}
                                class={styles.additionalInput}
                                value={mediaItems()[0]?.genre || ''}
                                onChange={(event) => handleBaseFieldsChange('genre', event.target.value)}
                              />
                            </div>
                          </Show>
                          <Show when={draft.layout !== 'audio'}>
                            <Show when={isSubtitleVisible()}>
                              <GrowingTextarea
                                textAreaRef={setSubtitleInput}
                                allowEnterKey={false}
                                onChange={(value: string) => handleInputChange('subtitle', value || '')}
                                class={styles.subtitleInput}
                                placeholder={t('Subheader')}
                                initialValue={draft.subtitle || ''}
                                maxLength={MAX_HEADER_LIMIT}
                              />
                            </Show>
                            <Show when={isLeadVisible()}>
                              <div class={styles.leadEditorWrapper}>
                                <SimpleRichEditor
                                  editorId={`draft-${draft.id}-lead`}
                                  fieldType="lead"
                                  toolbar="bottom"
                                  commands={['bold', 'italic', 'link']}
                                  placeholder={t('A short introduction to keep the reader interested')}
                                  content={getEditorContent(`draft-${draft.id}-lead`) || draft.lead || ''}
                                  onChange={(data) => handleLeadEditorChange(data)}
                                  onInit={(instance) => setLeadEditorRef(instance.editor)}
                                  onBlur={() => {
                                    console.log('[EditView] Lead editor blur detected, saving lead content')
                                    saveLead()
                                  }}
                                />
                              </div>
                            </Show>
                            <Show when={!isLeadVisible() && draft.lead}>
                              <div
                                class={styles.leadContentDisplay}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()

                                  if (isLeadVisible()) {
                                    console.log('[EditView] Lead editor already visible, skipping click')
                                    return
                                  }

                                  console.log('[EditView] Click on lead preview, showing lead editor')

                                  showLeadInput()

                                  setTimeout(() => {
                                    if (!isLeadVisible()) {
                                      console.log('[EditView] Ensuring lead editor is visible')
                                      setIsLeadVisible(true)
                                    }
                                  }, 100)
                                }}
                              >
                                {(() => {
                                  const draftId = draft.id || 0
                                  const leadContent =
                                    getEditorContent(`draft-${draftId}-lead`) || draft.lead || ''

                                  const finalLead = leadContent

                                  if (isEmptyContent(finalLead)) {
                                    return null
                                  }

                                  return (
                                    <>
                                      <div innerHTML={finalLead} class={styles.leadContentText} />
                                    </>
                                  )
                                })()}
                              </div>
                            </Show>
                          </Show>
                        </div>
                        <Show when={draft.layout === 'audio'}>
                          <Show
                            when={draft.cover}
                            fallback={
                              <DropArea
                                isSquare={true}
                                placeholder={t('Add cover')}
                                description={
                                  <>
                                    {t('min. 1400×1400 pix')}
                                    <br />
                                    {t('jpg, .png, max. 10 mb.')}
                                  </>
                                }
                                isMultiply={false}
                                fileType={'image'}
                                onUpload={(val: { url: string }[]) =>
                                  handleInputChange('cover', val[0].url)
                                }
                              />
                            }
                          >
                            <div
                              class={styles.cover}
                              style={{
                                'background-image': `url(${getFileUrl(draft.cover || '', {
                                  width: 1600
                                })})`
                              }}
                            >
                              <Popover content={t('Delete cover')}>
                                {(triggerRef: (_el: HTMLElement | null) => void) => (
                                  <div
                                    ref={triggerRef}
                                    class={styles.delete}
                                    onClick={() => handleInputChange('cover', '')}
                                  >
                                    <Icon name="close-white" />
                                  </div>
                                )}
                              </Popover>
                            </div>
                          </Show>
                        </Show>
                      </div>

                      <Show when={draft.layout === 'image'}>
                        <EditorSwiper
                          images={mediaItems()}
                          onImageChange={handleMediaChange}
                          onImageDelete={(index: number) => handleMediaDelete(index)}
                          onImagesAdd={(value: MediaItem[]) => handleAddMedia(value)}
                          onImagesSorted={(value: MediaItem[]) => handleSortedMedia(value)}
                        />
                      </Show>

                      <Show when={draft.layout === 'video'}>
                        <VideoUploader
                          video={mediaItems()}
                          onVideoAdd={(data: MediaItem[]) => handleAddMedia(data)}
                          onVideoDelete={(index: number) => handleMediaDelete(index)}
                        />
                      </Show>

                      <Show when={draft.layout === 'audio'}>
                        <AudioUploader
                          audio={mediaItems()}
                          baseFields={baseAudioFields()}
                          onAudioAdd={(value) => handleAddMedia(value)}
                          onAudioChange={handleMediaChange}
                          onAudioSorted={(value) => handleSortedMedia(value)}
                        />
                      </Show>
                    </>
                  )
                })()}
              </div>
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
                  <SimpleRichEditor
                    editorId={`draft-${draft.id}-body`}
                    fieldType="body"
                    toolbar="float"
                    commands={featuredEditorCommands as readonly (CommandType | readonly CommandType[])[]}
                    content={getEditorContent(`draft-${draft.id}-body`) || draft.body || ''}
                    onChange={(data) => handleInputChange('body', data)}
                    onInit={(instance) => {
                      setBodyEditorRef(instance.editor)
                      console.log('[EditView] Body editor initialized')
                    }}
                    onFocus={() => handleBodyEditorFocus(true)}
                    onBlur={() => handleBodyEditorFocus(false)}
                    plus={true}
                  />
                )
              })()}
            </div>
          </div>
        </div>
      </div>

      <Modal variant="medium" name="inviteCoauthors">
        <InviteMembers variant={'coauthors'} title={t('Invite experts')} />
      </Modal>
    </>
  )
}

export default EditView
