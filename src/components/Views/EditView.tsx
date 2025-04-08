import { clsx } from 'clsx'
import { Show, createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'

import { DropArea } from '~/components/_shared/DropArea'
import { Icon } from '~/components/_shared/Icon'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Modal } from '~/components/_shared/Modal'
import { Popover } from '~/components/_shared/Popover'
import { EditorSwiper } from '~/components/_shared/SolidSwiper'
import { useConnect } from '~/context/connect'
import { DraftInput, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import type { Draft, MediaItem, Topic } from '~/graphql/schema/core.gen'
import { slugify } from '~/intl/translit'
import { getFileUrl } from '~/lib/getThumbUrl'
import { LayoutType } from '~/types/common'
import { EditorData, SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
import { getProvider } from '../SimpleRichEditor/lib/awareness'
import { isEmptyContent } from '../SimpleRichEditor/lib/empty'
import { sanitizeHtml } from '../SimpleRichEditor/lib/sanitize'
import {
  applyOfflineChanges,
  getAllDraftFields,
  getDraftInputWithOfflineChanges,
  hasUnsyncedChanges,
  saveDraftField,
  saveEntireDraft,
  setupNetworkListeners,
  updateLastSync
} from '../SimpleRichEditor/lib/storage'
import { AudioUploader } from '../Upload/AudioUploader'
import { VideoUploader } from '../Upload/VideoUploader'
import GrowingTextarea from '../_shared/GrowingTextarea/GrowingTextarea'

import styles from '~/styles/views/EditView.module.scss'

export const MAX_HEADER_LIMIT = 100
export const EMPTY_TOPIC: Topic = {
  id: -1,
  slug: ''
}

/**
 * EditView component
 *
 * @returns EditView component
 */
export const EditView = (props: { draft?: Draft }) => {
  const { t } = useLocalize()
  const { updateDraft, getEditorContent, setEditorContent } = useDrafts()
  const [inputDataErrors, setFormErrors] = createSignal({} as Record<keyof DraftInput, string>)
  const [subtitleInput, setSubtitleInput] = createSignal<HTMLTextAreaElement | undefined>()
  const [currentDraft, setCurrentDraft] = createSignal<Draft | undefined>(props.draft)
  // Handling when draft data is changed
  const [isSubtitleVisible, setIsSubtitleVisible] = createSignal(false)
  const [isLeadVisible, setIsLeadVisible] = createSignal(false)
  const [mediaItems, setMediaItems] = createSignal<MediaItem[]>([])
  // Сигнал для основного редактора
  const [bodyEditorRef, setBodyEditorRef] = createSignal<HTMLDivElement>()
  // Сигнал для отслеживания фокуса на основном редакторе
  const [isBodyEditorFocused, setIsBodyEditorFocused] = createSignal(false)

  // Добавляем сигнал для хранения исходного содержимого вступления перед редактированием
  const [originalLeadContent, setOriginalLeadContent] = createSignal('')

  // Эффект для инициализации состояния, если props.draft существует
  createEffect(() => {
    if (props.draft) {
      setCurrentDraft(props.draft)

      // При инициализации сразу показываем вступление в режиме превью, если оно существует
      if (props.draft.lead) {
        console.log('[EditView] Initializing draft with lead', {
          draftId: props.draft.id,
          leadContent: props.draft.lead,
          leadLength: props.draft.lead.length,
          isLeadVisible: isLeadVisible()
        })
        setIsLeadVisible(false) // Чтобы отображалось превью, а не редактор
      }
    }
  })

  createEffect(
    on(currentDraft, (d?: Draft) => {
      if (!d) return
      setIsSubtitleVisible(Boolean(d?.subtitle))

      // Для режима просмотра черновика, если редактор тела в фокусе, скрываем редактор вступления
      // но не скрываем само вступление в режиме превью
      if (isBodyEditorFocused()) {
        setIsLeadVisible(false)
      }

      setMediaItems((d?.media || []) as MediaItem[])
    })
  )

  // Эффект для автоматического скрытия редактора вступления при фокусе на основном редакторе
  createEffect(() => {
    if (isBodyEditorFocused() && isLeadVisible()) {
      // Если есть сохраненное вступление и редактор вступления активен,
      // сохраняем текущие изменения вступления и скрываем редактор
      const leadContent = getEditorContent(`draft-${currentDraft()?.id}-lead`) || ''
      if (isEmptyContent(leadContent)) {
        cancelLead()
      } else {
        saveLead()
      }
    }
  })

  // Handle scroll
  const [isScrolled, setIsScrolled] = createSignal(false)
  const handleScroll = () => setIsScrolled(window.scrollY > 0)

  // Добавляем обработчик клика по документу для установки фокуса на основной редактор
  const handleDocumentClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement

    // Проверяем, не является ли клик внутри заголовка, подзаголовка или вступления
    const isTitleClick = target.closest('.titleInput') || target.closest('input[type="text"]')
    const isLeadClick = target.closest('[data-field-type="lead"]')
    const isBodyClick = target.closest('[data-field-type="body"]')

    // Если клик не в заголовке, не во вступлении и не в основном редакторе
    if (!isTitleClick && !isLeadClick && !isBodyClick) {
      // Получаем ссылку на основной редактор и устанавливаем фокус
      const bodyEditor = bodyEditorRef()
      if (bodyEditor) {
        // Установка фокуса в конец документа
        bodyEditor.focus()

        // Перемещение курсора в конец контента
        const selection = window.getSelection()
        const range = document.createRange()

        if (selection && bodyEditor.childNodes.length > 0) {
          const lastChild = bodyEditor.lastChild
          if (lastChild) {
            // Если последний узел - текстовый, устанавливаем курсор в его конец
            if (lastChild.nodeType === Node.TEXT_NODE) {
              range.setStart(lastChild, lastChild.textContent?.length || 0)
            } else {
              // Иначе пытаемся разместить курсор внутри последнего элемента
              range.selectNodeContents(lastChild)
              range.collapse(false) // collapse to end
            }
            selection.removeAllRanges()
            selection.addRange(range)
          }
        }
      }
    }
  }

  // Добавляем обработчик клавиш для быстрого сохранения
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+S или Cmd+S для быстрого сохранения
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault() // Предотвращаем стандартное поведение браузера
      handleSaveClick()
    }
  }

  // Обработчик для изменений полей черновика
  const handleInputChange = (key: keyof DraftInput, val: string) => {
    let value = String(sanitizeHtml(val))
    if (key === 'body' || key === 'lead') {
      value = sanitizeHtml(val)
      setEditorContent(`draft-${currentDraft()?.id}-${key}`, value)
    }

    if (key === 'title') {
      handleInputChange('slug', slugify(value))
    }

    const draft = currentDraft()
    if (draft) {
      // Обновляем локальное состояние UI
      const updated = { ...draft, [key]: value } as Draft
      setCurrentDraft(updated)

      // Сохраняем изменение в localStorage для offline-first редактирования
      saveDraftField(draft.id, key, value)

      // Получаем провайдер awareness для синхронизации в реальном времени
      const awarenessProvider = getProvider()

      // Отправляем обновление через awareness для коллаборативного редактирования
      awarenessProvider.updateDraftField(
        draft.id,
        key,
        value,
        key === 'body' || key === 'lead' ? isEmptyContent(value) : false
      )
    }
  }

  // Добавляем функцию для получения обновлений от awareness
  const handleAwarenessUpdates = (_params: {
    added: number[]
    updated: number[]
    removed: number[]
  }) => {
    const draft = currentDraft()
    if (!draft) return

    // Получаем провайдер
    const awarenessProvider = getProvider()

    // Получаем актуальный контент для текущего черновика
    const draftFields = awarenessProvider.getDraftContent(draft.id)

    // Если получены обновления полей, обновляем локальный UI
    if (Object.keys(draftFields).length > 0) {
      // Создаем обновленный объект черновика
      const updatedDraft = { ...draft }

      // Обновляем поля, которые пришли из awareness
      Object.entries(draftFields).forEach(([fieldName, fieldData]) => {
        // Проверяем, что такое поле существует в черновике
        if (fieldName in draft && fieldName !== 'id' && fieldData.content) {
          // Обновляем локальный контент
          console.log(`[EditView] Updating field ${fieldName} from awareness`)

          // Для редакторов обновляем контент в хранилище
          if (fieldName === 'body' || fieldName === 'lead') {
            setEditorContent(`draft-${draft.id}-${fieldName}`, fieldData.content)
          }

          // Обновляем объект черновика (безопасно для типизации)
          const draftToUpdate = updatedDraft as unknown as Record<string, unknown>

          // Обновляем только поля, которые мы точно знаем, что они строковые
          if (
            fieldName === 'body' ||
            fieldName === 'lead' ||
            fieldName === 'title' ||
            fieldName === 'subtitle' ||
            fieldName === 'slug' ||
            fieldName === 'description'
          ) {
            draftToUpdate[fieldName] = fieldData.content
          }
        }
      })

      // Обновляем состояние только если были изменения
      if (JSON.stringify(updatedDraft) !== JSON.stringify(draft)) {
        setCurrentDraft(updatedDraft)
      }
    }
  }

  const { addHandler } = useConnect()

  // Функция проверки и восстановления локальных изменений черновика
  const restoreOfflineChanges = (draft: Draft): void => {
    if (!draft || !draft.id) return

    try {
      // Проверяем, есть ли локальные изменения
      const fields = getAllDraftFields(draft.id)
      if (!fields) return

      console.log(`[EditView] Found offline changes for draft ${draft.id}`)

      // Применяем локальные изменения к UI
      const updatedDraft = applyOfflineChanges(draft.id, draft)

      // Обновляем состояние черновика
      setCurrentDraft(updatedDraft)

      // Обновляем содержимое редакторов, если локальные изменения затронули поля body или lead
      if (fields.body && updatedDraft.body !== draft.body) {
        setEditorContent(`draft-${draft.id}-body`, fields.body)
      }

      if (fields.lead && updatedDraft.lead !== draft.lead) {
        setEditorContent(`draft-${draft.id}-lead`, fields.lead)
      }

      console.log('[EditView] Restored offline changes')

      // Регистрируем обработчик для изменений
      addHandler(() => {
        // Проверяем, онлайн ли пользователь перед синхронизацией
        if (navigator.onLine) {
          console.log('[EditView] Syncing changes after content update')
          syncOfflineChanges(draft)
        }
      })
    } catch (error) {
      console.error('[EditView] Error restoring offline changes:', error)
    }
  }

  // Функция для синхронизации локальных изменений с сервером
  const syncOfflineChanges = (draft: Draft): void => {
    if (!draft || !draft.id) return

    try {
      if (hasUnsyncedChanges(draft.id)) {
        console.log('[EditView] Syncing offline changes to server')

        // Готовим объект для отправки на сервер
        const syncDraft = getDraftInputWithOfflineChanges(draft.id, draft)

        // Отправляем на сервер
        updateDraft(syncDraft as DraftInput)

        // Обновляем время последней синхронизации
        updateLastSync(draft.id)
      }
    } catch (error) {
      console.error('[EditView] Error syncing offline changes:', error)
    }
  }

  // Обработчик для явного сохранения черновика
  const handleSaveClick = () => {
    const draft = currentDraft()
    if (!draft) return

    // При явном сохранении используем GraphQL mutation для обновления черновика на сервере
    console.log('[EditView] Explicitly saving draft to server via GraphQL', draft.id)

    // Синхронизируем все локальные изменения
    syncOfflineChanges(draft)
  }

  const handleTitleInputChange = (value: string) => {
    handleInputChange('title', value)
    handleInputChange('slug', slugify(value))
    value && setFormErrors((prev) => ({ ...prev, title: '' }))
  }

  const handleAddMedia = (data: MediaItem[]) => {
    const newMedia = [...mediaItems(), ...data]
    handleInputChange('media', JSON.stringify(newMedia))
  }
  const handleSortedMedia = (data: MediaItem[]) => {
    handleInputChange('media', JSON.stringify(data))
  }

  const handleMediaDelete = (index: number) => {
    const copy = [...mediaItems()]
    if (copy?.length > 0) copy.splice(index, 1)
    handleInputChange('media', JSON.stringify(copy))
  }

  const handleMediaChange = (index: number, value: MediaItem) => {
    const updated = mediaItems().map((item, idx) => (idx === index ? value : item))
    handleInputChange('media', JSON.stringify(updated))
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
    subtitleInput()?.focus()
  }

  const showLeadInput = () => {
    // Убираем фокус с основного редактора, если он был
    setIsBodyEditorFocused(false)

    // Сохраняем исходное содержимое для возможности отмены
    const currentLead = currentDraft()?.lead || ''
    setOriginalLeadContent(currentLead)

    // Добавляем отладочную информацию
    console.log('[EditView] showLeadInput', {
      draftId: currentDraft()?.id,
      currentLead,
      isEmpty: isEmptyContent(currentLead)
    })

    // Показываем редактор ПЕРЕД установкой контента
    setIsLeadVisible(true)

    // Устанавливаем контент в редактор
    setEditorContent(`draft-${currentDraft()?.id}-lead`, currentLead)

    // Выставляем фокус на редактор с небольшой задержкой
    setTimeout(() => {
      const leadEditor = document.querySelector(
        `[data-editor-id="draft-${currentDraft()?.id}-lead"]`
      ) as HTMLElement

      if (leadEditor) {
        // Если содержимое не пустое, убеждаемся что плейсхолдер скрыт
        if (isEmptyContent(currentLead)) {
          leadEditor.classList.add('placeholder-visible')
        } else {
          leadEditor.classList.remove('placeholder-visible')
        }

        // Устанавливаем фокус
        leadEditor.focus()
      }
    }, 100)
  }

  const hideLeadInput = () => {
    setIsLeadVisible(false)
  }

  // Функция сохранения вступления
  const saveLead = () => {
    // Получаем содержимое из редактора
    const leadContent = getEditorContent(`draft-${currentDraft()?.id}-lead`)

    // Если содержимое пустое, отменяем редактирование и скрываем редактор
    if (isEmptyContent(leadContent)) {
      cancelLead()
      return
    }

    // Сохраняем в черновик
    handleInputChange('lead', leadContent)

    // Скрываем редактор
    hideLeadInput()
  }

  // Обновляем функцию отмены редактирования
  const cancelLead = () => {
    // Возвращаем исходное содержимое без сохранения новых изменений
    setEditorContent(`draft-${currentDraft()?.id}-lead`, originalLeadContent())

    // Если исходное содержимое было пустым и мы отменяем редактирование,
    // удаляем поле lead из черновика
    if (isEmptyContent(originalLeadContent())) {
      handleInputChange('lead', '')
    }

    // Скрываем редактор
    hideLeadInput()
  }

  // Обновляем обработчик изменений редактора введения
  const handleLeadEditorChange = (data: EditorData) => {
    // Обновляем сохраненное содержимое редактора
    setEditorContent(`draft-${currentDraft()?.id}-lead`, data.content)

    // Проверяем содержимое на пустоту с использованием isEmptyContent
    if (isEmptyContent(data.content)) {
      // Если содержимое пустое, удаляем поле lead из черновика
      handleInputChange('lead', '')
    } else {
      // Если содержимое не пустое, обновляем черновик
      handleInputChange('lead', data.content)
    }
  }

  // Обработчик фокуса/блюра для основного редактора
  const handleBodyEditorFocus = (isFocused: boolean) => {
    setIsBodyEditorFocused(isFocused)

    // Если фокус устанавливается на основной редактор и редактор вступления открыт,
    // автоматически сохраняем и скрываем редактор вступления
    if (isFocused && isLeadVisible()) {
      const leadContent = getEditorContent(`draft-${currentDraft()?.id}-lead`)

      // Используем isEmptyContent для корректной проверки на пустое содержимое
      if (isEmptyContent(leadContent)) {
        cancelLead()
      } else {
        saveLead()
      }

      // Гарантированно скрываем редактор вступления при фокусе на основном редакторе
      setIsLeadVisible(false)
    }
  }

  const HeadingActions = () => {
    return (
      <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
        <Show when={currentDraft()}>
          <div class={styles.headingActions}>
            <Show when={!isSubtitleVisible() && currentDraft()?.layout !== 'audio'}>
              <a class={styles.action} onClick={showSubtitleInput}>
                {t('Add subtitle')}
              </a>
            </Show>
            <Show when={!isLeadVisible() && !currentDraft()?.lead && currentDraft()?.layout !== 'audio'}>
              <a class={styles.action} onClick={showLeadInput}>
                {t('Add intro')}
              </a>
            </Show>
          </div>
          <>
            <div class={clsx({ [styles.audioHeader]: currentDraft()?.layout === 'audio' })}>
              <div class={styles.inputContainer}>
                <GrowingTextarea
                  allowEnterKey={true}
                  onChange={(value) => handleTitleInputChange(value)}
                  class={styles.titleInput}
                  placeholder={articleTitle()}
                  initialValue={currentDraft()?.title || ''}
                  maxLength={MAX_HEADER_LIMIT}
                />

                <Show when={inputDataErrors().title}>
                  <div class={styles.validationError}>{inputDataErrors().title}</div>
                </Show>

                <Show when={currentDraft()?.layout === 'audio'}>
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
                <Show when={currentDraft()?.layout !== 'audio'}>
                  <Show when={isSubtitleVisible()}>
                    <GrowingTextarea
                      textAreaRef={setSubtitleInput}
                      allowEnterKey={false}
                      onChange={(value: string) => handleInputChange('subtitle', value || '')}
                      class={styles.subtitleInput}
                      placeholder={t('Subheader')}
                      initialValue={currentDraft()?.subtitle || ''}
                      maxLength={MAX_HEADER_LIMIT}
                    />
                  </Show>
                  <Show when={isLeadVisible()}>
                    <div class={styles.leadEditorWrapper}>
                      <SimpleRichEditor
                        editorId={`draft-${currentDraft()?.id}-lead`}
                        fieldType="lead"
                        toolbar="bottom"
                        commands={['bold', 'italic', 'link']}
                        placeholder={t('A short introduction to keep the reader interested')}
                        content={getEditorContent(`draft-${currentDraft()?.id}-lead`) || ''}
                        onChange={handleLeadEditorChange}
                        onBlur={saveLead} // Автоматически сохраняем при потере фокуса
                      />
                    </div>
                  </Show>
                  <Show when={!isLeadVisible() && currentDraft()?.lead}>
                    <div class={styles.leadContentDisplay} onClick={showLeadInput}>
                      <div innerHTML={currentDraft()?.lead || ''} class={styles.leadContentText} />
                    </div>
                  </Show>
                </Show>
              </div>
              <Show when={currentDraft()?.layout === 'audio'}>
                <Show
                  when={currentDraft()?.cover}
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
                      onUpload={(val: { url: string }[]) => handleInputChange('cover', val[0].url)}
                    />
                  }
                >
                  <div
                    class={styles.cover}
                    style={{
                      'background-image': `url(${getFileUrl(currentDraft()?.cover || '', {
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
          </>
        </Show>
      </div>
    )
  }

  onMount(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('keydown', handleKeyDown)
    // Добавляем обработчик клика для всего документа
    document.addEventListener('click', handleDocumentClick, { passive: true })

    // Инициализируем соединение с сервером для синхронизации черновика
    const draft = currentDraft()
    if (draft?.id) {
      try {
        // Восстанавливаем локальные изменения, если есть
        restoreOfflineChanges(draft)

        // Настраиваем слушатели изменения сети
        const removeNetworkListeners = setupNetworkListeners(
          // Колбэк для перехода в онлайн
          () => {
            if (currentDraft()) {
              syncOfflineChanges(currentDraft() as Draft)
            }
          },
          // Колбэк для перехода в оффлайн
          () => {
            console.log('[EditView] Switching to offline mode')
          }
        )

        // Получаем провайдер awareness
        const awarenessProvider = getProvider()

        // Получаем функцию addHandler из контекста
        const { addHandler } = useConnect()

        // Устанавливаем информацию о пользователе
        const { session } = useSession()
        const s = session()
        const tabId = crypto.randomUUID()

        if (s) {
          // Устанавливаем информацию о пользователе с безопасным получением данных
          awarenessProvider.setUserInfo(`draft-${draft.id}`, {
            id: s.user?.email || 'guest',
            name: s.user?.email?.split('@')?.[0] || 'Пользователь',
            color: `#${Math.floor(Math.random() * 16777215).toString(16)}`, // Случайный цвет
            tabId
          })
        }

        // Подключаемся к редактору с идентификатором черновика
        const editorId = `draft-${draft.id}`
        console.log('[EditView] Connecting to awareness for draft', draft.id)

        // Устанавливаем функцию addHandler в провайдер, чтобы она была доступна внутри
        awarenessProvider['addHandler'] = addHandler

        // Вызываем стандартный метод connect в провайдере
        awarenessProvider.connect(editorId)

        // Подписываемся на обновления awareness
        const unsubscribe = awarenessProvider.onAwarenessChange(handleAwarenessUpdates)

        console.log('[EditView] Connected to awareness for draft', draft.id)

        // Сохраняем весь черновик в localStorage при инициализации
        saveEntireDraft(draft)

        // Отписываемся при размонтировании
        onCleanup(() => {
          removeNetworkListeners()
          unsubscribe()
          window.removeEventListener('scroll', handleScroll)
          window.removeEventListener('keydown', handleKeyDown)
          document.removeEventListener('click', handleDocumentClick)
        })
      } catch (error) {
        console.error('[EditView] Failed to connect to awareness:', error)
      }
    }
  })

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
              <HeadingActions />
            </div>
          </div>
        </div>
      </div>

      {/* Основной редактор */}
      <div class="wide-container">
        <div class="row">
          <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
            <div class={styles.mainEditorContainer}>
              <SimpleRichEditor
                editorId={`draft-${currentDraft()?.id}-body`}
                fieldType="body"
                toolbar="float"
                commands={['bold', 'italic', 'link', 'blockquote', 'image']}
                content={getEditorContent(`draft-${currentDraft()?.id}-body`) || ''}
                onChange={(data: EditorData) => handleInputChange('body', data.content)}
                onInit={(instance) => setBodyEditorRef(instance.editor)}
                onFocus={() => handleBodyEditorFocus(true)}
                onBlur={() => handleBodyEditorFocus(false)}
                plus={true}
              />
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
