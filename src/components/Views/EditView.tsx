import { clsx } from 'clsx'
import { Show, createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'

import { DropArea } from '~/components/_shared/DropArea'
import { Icon } from '~/components/_shared/Icon'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Modal } from '~/components/_shared/Modal'
import { Popover } from '~/components/_shared/Popover'
import { EditorSwiper } from '~/components/_shared/SolidSwiper'
import { useConnect } from '~/context/connect'
import { DraftInput as ContextDraftInput, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import type { Draft, DraftInput, MediaItem, Topic } from '~/graphql/schema/core.gen'
import { slugify } from '~/intl/translit'
import { getFileUrl } from '~/lib/getThumbUrl'
import { LayoutType } from '~/types/nav'
import { SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
import { getProvider } from '../SimpleRichEditor/lib/awareness'
import { isEmptyContent } from '../SimpleRichEditor/lib/empty'
import {
  getAllDraftFields,
  getDraftField,
  hasUnsyncedChanges,
  parseJsonContent,
  saveDraftField,
  saveEntireDraft,
  updateLastSync
} from '../SimpleRichEditor/lib/storage'
import { AudioUploader } from '../Upload/AudioUploader'
import { VideoUploader } from '../Upload/VideoUploader'
import GrowingTextarea from '../_shared/GrowingTextarea/GrowingTextarea'

import styles from '~/styles/views/EditView.module.scss'
import { CommandType, EditorData } from '../SimpleRichEditor/lib/types'

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
  const { updateDraft } = useDrafts()
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
  // Добавляем сигнал для отслеживания клика на заголовок
  const [isTitleClicked, setIsTitleClicked] = createSignal(false)

  // Добавляем сигнал для хранения исходного содержимого вступления перед редактированием
  const [originalLeadContent, setOriginalLeadContent] = createSignal('')

  // Ref для редактора вступления
  const [leadEditorRef, setLeadEditorRef] = createSignal<HTMLDivElement>()

  // Эффект для инициализации состояния, если props.draft существует
  const [isInitialized, setIsInitialized] = createSignal(false)

  // Локальные реализации методов для работы с редактором
  const [editorsContent, setEditorsContentState] = createSignal<Record<string, string>>({})

  // Получение содержимого редактора
  const getEditorContent = (editorId: string): string => {
    return (
      editorsContent()[editorId] || getDraftField(currentDraft()?.id || 0, editorId.split('-')[2]) || ''
    )
  }

  // Установка содержимого редактора
  const setEditorContent = (editorId: string, content: string): void => {
    setEditorsContentState({ ...editorsContent(), [editorId]: content })
  }

  // Обновление поля черновика
  const updateDraftField = (
    draftId: number,
    fieldName: keyof DraftInput,
    value: string | EditorData,
    isEditorUpdate: boolean
  ): void => {
    let cleanValue = ''

    if (typeof value === 'object' && value !== null && 'content' in value) {
      cleanValue = value.content
    } else if (typeof value === 'string') {
      cleanValue = value
    }

    // Сохраняем в localStorage
    saveDraftField(draftId, fieldName, cleanValue)

    // Обновляем локальное состояние
    if (isEditorUpdate && (fieldName === 'body' || fieldName === 'lead')) {
      const editorId = `draft-${draftId}-${fieldName}`
      setEditorContent(editorId, cleanValue)
    }
  }

  createEffect(() => {
    if (props.draft) {
      setCurrentDraft(props.draft)

      // При инициализации сразу показываем вступление в режиме превью, если оно существует
      // Применяем только при первой инициализации, а не при каждом обновлении черновика
      if (props.draft.lead && !isInitialized()) {
        console.log('[EditView] Initializing draft with lead', {
          draftId: props.draft.id,
          leadContent: props.draft.lead,
          leadLength: props.draft.lead.length,
          isLeadVisible: isLeadVisible()
        })
        setIsLeadVisible(false) // Чтобы отображалось превью, а не редактор
        setIsInitialized(true) // Отмечаем, что инициализация произошла
      }
    }
  })

  createEffect(
    on(currentDraft, (d?: Draft) => {
      if (!d) return
      setIsSubtitleVisible(Boolean(d?.subtitle))

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

  // Эффект для фокусировки редактора вступления, когда он становится видимым
  createEffect(() => {
    if (isLeadVisible()) {
      // Добавляем задержку больше, чем в обработчике клика,
      // чтобы он выполнился после нашего ручного установления фокуса
      setTimeout(() => {
        // Проверяем, что редактор все еще видим, чтобы не перехватывать фокус у других элементов
        if (!isLeadVisible()) return

        const editorElement = leadEditorRef()
        if (editorElement) {
          // Проверяем, не установлен ли уже фокус на редакторе
          if (document.activeElement !== editorElement) {
            const leadContent = getEditorContent(`draft-${currentDraft()?.id}-lead`) || ''
            if (isEmptyContent(leadContent)) {
              editorElement.classList.add('placeholder-visible')
            } else {
              editorElement.classList.remove('placeholder-visible')
            }

            // Фокусируем только если фокус еще не установлен на редакторе
            editorElement.focus()
            console.log('[EditView] Focused lead editor via effect (not already focused)')
          }
        }
      }, 200) // Задержка больше, чем в обработчике клика
    }
  })

  // Handle scroll
  const [isScrolled, setIsScrolled] = createSignal(false)
  const handleScroll = () => setIsScrolled(window.scrollY > 0)

  // Добавляем обработчик клика по документу для установки фокуса на основной редактор
  const handleDocumentClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement

    // Проверяем, не является ли клик внутри заголовка или текстового поля
    const isTitleClick = target.closest('.titleInput') || target.closest('input[type="text"]')

    // Проверка для редактора лида (когда он видим)
    const isLeadEditorClick = target.closest('[data-field-type="lead"]')

    // Улучшенная проверка для превью лида
    const isLeadPreviewClick = Boolean(
      target.closest(`.${styles.leadContentDisplay}`) ||
        target.closest(`.${styles.leadContentText}`) ||
        target.classList?.contains(styles.leadContentDisplay) ||
        target.classList?.contains(styles.leadContentText)
    )

    // Проверка для ссылок действий над заголовком
    const isHeadingActionsClick = Boolean(target.closest(`.${styles.headingActions}`))

    // Проверка для основного редактора
    const isBodyClick = Boolean(target.closest('[data-field-type="body"]'))

    // Если клик не в заголовке и не в действиях над заголовком, сбрасываем состояние клика на заголовок
    if (!isTitleClick && !isHeadingActionsClick) {
      setIsTitleClicked(false)
    }

    // Добавляем логирование для отладки, какой элемент обнаружен
    if (isLeadPreviewClick) {
      console.log('[EditView] Click detected on lead preview, skipping body focus')
      return // Явно пропускаем обработку, если клик на превью
    }

    // Если клик в редакторе лида, тоже пропускаем (пусть обработчик редактора сам разбирается)
    if (isLeadEditorClick) {
      console.log('[EditView] Click detected in lead editor, skipping body focus')
      return
    }

    // Если клик по заголовку, показываем действия и предотвращаем фокус на основном редакторе
    if (isTitleClick) {
      console.log('[EditView] Click detected on title, showing actions')
      setIsTitleClicked(true)
      // Предотвращаем всплытие события до document
      e.stopPropagation()
      e.preventDefault() 
      return
    }

    // Если клик по действиям заголовка, предотвращаем фокус на основном редакторе
    if (isHeadingActionsClick) {
      console.log('[EditView] Click detected on heading actions, skipping body focus')
      e.stopPropagation() 
      return
    }

    // Если клик не в заголовке, не в редакторе/превью лида и не в основном редакторе,
    // то устанавливаем фокус на основной редактор
    if (!isTitleClick && !isLeadEditorClick && !isLeadPreviewClick && !isBodyClick && !isHeadingActionsClick) {
      // Дополнительная защита - если редактор лида открыт, не перехватываем фокус
      if (isLeadVisible()) {
        console.log('[EditView] Lead editor is visible, skipping focus to body')
        return
      }

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
            if (selection) {
              selection.removeAllRanges()
              selection.addRange(range)
            }
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
  const handleInputChange = (key: keyof DraftInput, val: string | EditorData) => {
    const draft = currentDraft()
    if (!draft || !draft.id) return

    const isEditorUpdate = typeof val === 'object' && val !== null && 'content' in val

    // Вызываем функцию из контекста для обновления поля
    updateDraftField(draft.id, key, val, isEditorUpdate)

    // Обновляем локальное состояние UI (опционально, если контекст не обновляет drafts())
    let updateValue: string
    if (isEditorUpdate) {
      // Получаем НЕОЧИЩЕННЫЙ контент для локального UI,
      // т.к. санитизация происходит в контексте перед сохранением
      updateValue = (val as EditorData).content
    } else {
      updateValue = val as string
    }
    setCurrentDraft((prev) => (prev ? { ...prev, [key]: updateValue } : undefined))

    // Обновление слага при изменении заголовка (можно перенести в контекст)
    if (key === 'title' && typeof val === 'string') {
      const slugValue = slugify(val)
      setCurrentDraft((prev) => (prev ? { ...prev, slug: slugValue } : undefined))
      // Сохранение слага также лучше делать через updateDraftField, если нужно
      // updateDraftField(draft.id, 'slug', slugValue, false)
    }

    // Получаем провайдер awareness для синхронизации в реальном времени
    const awarenessProvider = getProvider()

    // Отправляем обновление через awareness для коллаборативного редактирования
    awarenessProvider.updateDraftField(
      draft.id,
      key,
      updateValue, // Отправляем чистый HTML
      key === 'body' || key === 'lead' ? isEmptyContent(updateValue) : false
    )
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

    // Проверяем, подключен ли провайдер
    if (awarenessProvider.getConnectionState() !== 'connected') {
      return
    }

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
            // Проверяем, не является ли контент JSON-строкой
            const contentToSet = parseJsonContent(fieldData.content)
            setEditorContent(`draft-${draft.id}-${fieldName}`, contentToSet)
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
            // Если это body или lead, проверяем не является ли контент JSON-строкой
            if (fieldName === 'body' || fieldName === 'lead') {
              draftToUpdate[fieldName] = parseJsonContent(fieldData.content)
            } else {
              draftToUpdate[fieldName] = fieldData.content
            }
          }
        }
      })

      // Обновляем состояние только если были изменения
      if (JSON.stringify(updatedDraft) !== JSON.stringify(draft)) {
        setCurrentDraft(updatedDraft)
      }
    }
  }

  // Функция для восстановления локальных изменений
  const restoreOfflineChanges = (draft: Draft) => {
    if (!draft || !draft.id) return

    try {
      // Получаем все поля черновика из localStorage
      const offlineFields = getAllDraftFields(draft.id)
      console.log('[EditView] Checking offline fields:', offlineFields)

      // Если есть локальные изменения, восстанавливаем их
      if (offlineFields && Object.keys(offlineFields).length > 0) {
        // Получаем актуальное содержимое из localStorage
        let bodyContent = draft.body || ''
        let leadContent = draft.lead || ''
        const titleContent = getDraftField(draft.id, 'title') || draft.title || ''
        const subtitleContent = getDraftField(draft.id, 'subtitle') || draft.subtitle || ''

        // Обрабатываем JSON для lead и body
        const bodyFromStorage = getDraftField(draft.id, 'body')
        if (bodyFromStorage) {
          bodyContent = parseJsonContent(bodyFromStorage) || bodyContent
          console.log(`[EditView] Parsed body content from storage for draft ${draft.id}`)
        }

        const leadFromStorage = getDraftField(draft.id, 'lead')
        if (leadFromStorage) {
          leadContent = parseJsonContent(leadFromStorage) || leadContent
          console.log(`[EditView] Parsed lead content from storage for draft ${draft.id}`)
        }

        // Обновляем локальное состояние, если есть изменения
        const updatedDraft = { ...draft } as Record<string, unknown>

        if (bodyContent && bodyContent !== draft.body) {
          updatedDraft.body = bodyContent
          setEditorContent(`draft-${draft.id}-body`, bodyContent)
        }

        if (leadContent && leadContent !== draft.lead) {
          updatedDraft.lead = leadContent
          setEditorContent(`draft-${draft.id}-lead`, leadContent)
        }

        if (titleContent && titleContent !== draft.title) {
          updatedDraft.title = titleContent
        }

        if (subtitleContent && subtitleContent !== draft.subtitle) {
          updatedDraft.subtitle = subtitleContent
        }

        // Обновляем состояние черновика, если были изменения
        if (JSON.stringify(updatedDraft) !== JSON.stringify(draft)) {
          setCurrentDraft(updatedDraft as Draft)
          console.log('[EditView] Restored offline changes:', updatedDraft)
        }
      }
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
        const syncDraft = {
          ...getAllDraftFields(draft.id),
          ...draft,
          id: draft.id, // Явно указываем id как число
          topic_ids: draft.topics?.map((topic) => topic?.id) || [],
          main_topic_id: draft.topics?.[0]?.id || 0,
          layout: draft.layout || 'article'
        }

        // Отправляем на сервер
        updateDraft(syncDraft as ContextDraftInput)

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
    console.log('[EditView] Explicitly saving draft to server via GraphQL', draft.id)
    syncOfflineChanges(draft)
  }

  // Компонент индикатора офлайн-режима
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

    // Получаем и обрабатываем содержимое вступления
    const draft = currentDraft()
    const draftId = draft?.id || 0

    // Получаем актуальное содержимое из localStorage с приоритетом над значением из черновика
    let currentLead = ''

    if (draftId) {
      // Пытаемся получить значение из localStorage
      const storedLead = getDraftField(draftId, 'lead')

      // Используем функцию parseJsonContent для корректного извлечения содержимого
      currentLead = parseJsonContent(storedLead || '') || draft?.lead || ''

      console.log('[EditView] showLeadInput extracting content:', {
        draftId,
        rawStoredLead: storedLead,
        parsedLead: parseJsonContent(storedLead || ''),
        draftLead: draft?.lead,
        finalLead: currentLead
      })
    }

    // Сохраняем исходное содержимое для возможности отмены
    setOriginalLeadContent(currentLead)

    // Добавляем отладочную информацию
    console.log('[EditView] showLeadInput', {
      draftId,
      currentLead,
      isEmpty: isEmptyContent(currentLead)
    })

    // Устанавливаем контент в состояние редактора перед показом
    setEditorContent(`draft-${draftId}-lead`, currentLead)

    // Показываем редактор лида
    setIsLeadVisible(true)

    // Используем одну задержку для фокусировки, чтобы гарантировать, что DOM обновился
    setTimeout(() => {
      const editorElement = leadEditorRef()
      if (editorElement) {
        // Устанавливаем фокус
        try {
          editorElement.focus()
          console.log('[EditView] Lead editor focused successfully')
        } catch (e) {
          console.error('[EditView] Error focusing lead editor:', e)
        }
      } else {
        console.warn('[EditView] Could not focus lead editor - element not found')
      }
    }, 100) // Достаточная задержка для обновления DOM
  }

  const hideLeadInput = () => {
    setIsLeadVisible(false)
  }

  // Функция сохранения вступления
  const saveLead = () => {
    const draftId = currentDraft()?.id
    if (!draftId) return

    const leadContent = getEditorContent(`draft-${draftId}-lead`) || ''
    if (isEmptyContent(leadContent)) {
      cancelLead() // Вызываем отмену, если пусто
      return
    }

    console.log('[EditView] Saving lead content via context:', {
      draftId,
      contentLength: leadContent.length
    })

    // Проверяем, не является ли leadContent JSON-строкой
    let contentToSave = leadContent
    if (leadContent.trim().startsWith('{') && leadContent.includes('"content"')) {
      try {
        const parsed = JSON.parse(leadContent)
        if (parsed && typeof parsed === 'object' && 'content' in parsed) {
          contentToSave = parsed.content
        }
      } catch (_e) {
        // Если ошибка парсинга, используем исходный контент
        console.warn('[EditView] Failed to parse lead JSON, using raw content')
      }
    }

    // Вызываем функцию контекста для обновления поля lead
    updateDraftField(
      draftId,
      'lead',
      {
        content: contentToSave, // Используем очищенный контент
        plainText: contentToSave.replace(/<[^>]+>/g, ''),
        length: contentToSave.replace(/<[^>]+>/g, '').length,
        isEmpty: false
      },
      true
    )

    // Обновляем состояние черновика напрямую для мгновенного отображения
    setCurrentDraft((prev) => {
      if (!prev) return prev
      return { ...prev, lead: contentToSave }
    })

    hideLeadInput()
  }

  // Функция отмены редактирования
  const cancelLead = () => {
    const draftId = currentDraft()?.id
    if (!draftId) return

    const originalContent = originalLeadContent()
    console.log('[EditView] Canceling lead edit, restoring original content via context:', {
      draftId,
      originalContent
    })

    // Восстанавливаем контент через контекст (сохраняем оригинальное значение)
    // Если оригинал пустой, передаем пустую строку
    updateDraftField(
      draftId,
      'lead',
      isEmptyContent(originalContent)
        ? ''
        : {
            content: originalContent,
            plainText: originalContent.replace(/<[^>]+>/g, ''),
            length: originalContent.replace(/<[^>]+>/g, '').length,
            isEmpty: isEmptyContent(originalContent)
          },
      true
    ) // true, т.к. это обновление редактора

    hideLeadInput()
  }

  // Обработчик изменений редактора вступления
  const handleLeadEditorChange = (data: EditorData) => {
    const draftId = currentDraft()?.id
    if (!draftId) return

    // Сохраняем только HTML-контент, а не весь объект
    const contentToSave = data.content

    // Напрямую сохраняем в localStorage чистое содержимое
    saveDraftField(draftId, 'lead', contentToSave)

    // Также обновляем состояние черновика
    setCurrentDraft((prev) => {
      if (!prev) return prev
      return { ...prev, lead: contentToSave }
    })
  }

  // Обработчик фокуса/блюра для основного редактора
  const handleBodyEditorFocus = (isFocused: boolean) => {
    setIsBodyEditorFocused(isFocused)

    // Если установлен фокус на основной редактор и редактор лида открыт,
    // то нужно сохранить изменения и скрыть редактор лида
    if (isFocused && isLeadVisible()) {
      console.log('[EditView] Body editor focused while lead editor is visible, saving lead')

      // Добавим небольшую задержку, чтобы дать время другим обработчикам кликов
      // закончить свою работу, если это клик был на превью
      setTimeout(() => {
        // Дополнительно проверяем, что лид все еще видим
        if (!isLeadVisible()) return

        const leadContent = getEditorContent(`draft-${currentDraft()?.id}-lead`)

        // Используем isEmptyContent для корректной проверки на пустое содержимое
        if (isEmptyContent(leadContent)) {
          cancelLead()
        } else {
          saveLead()
        }

        // Гарантированно скрываем редактор вступления при фокусе на основном редакторе
        setIsLeadVisible(false)
      }, 50)
    }
  }

  const HeadingActions = () => {
    return (
      <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
        <Show when={currentDraft()}>
          <OfflineIndicator />
          <div class={styles.headingActions}>
            <Show when={isTitleClicked() && !isSubtitleVisible() && currentDraft()?.layout !== 'audio'}>
              <a class={styles.action} onClick={showSubtitleInput}>
                {t('Add subtitle')}
              </a>
            </Show>
            <Show when={isTitleClicked() && !isLeadVisible() && !currentDraft()?.lead && currentDraft()?.layout !== 'audio'}>
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
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsTitleClicked(true)
                  }}
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
                        onChange={(data) => handleLeadEditorChange(data)}
                        onInit={(instance) => setLeadEditorRef(instance.editor)}
                        onBlur={() => {
                          console.log('[EditView] Lead editor blur detected, saving lead content')
                          saveLead() // Гарантированно вызываем сохранение при потере фокуса
                        }}
                      />
                    </div>
                  </Show>
                  <Show when={!isLeadVisible() && currentDraft()?.lead}>
                    <div
                      class={styles.leadContentDisplay}
                      onClick={(e) => {
                        e.preventDefault() // Предотвращаем стандартное поведение
                        e.stopPropagation() // Останавливаем всплытие события

                        // Добавим явную проверку, чтобы не обрабатывать повторные клики
                        if (isLeadVisible()) {
                          console.log('[EditView] Lead editor already visible, skipping click')
                          return
                        }

                        console.log('[EditView] Click on lead preview, showing lead editor')

                        // Сначала вызываем showLeadInput, который установит правильное состояние
                        showLeadInput()

                        // Дополнительная гарантия, что редактор будет видимым после всех асинхронных операций
                        setTimeout(() => {
                          if (!isLeadVisible()) {
                            console.log('[EditView] Ensuring lead editor is visible')
                            setIsLeadVisible(true)
                          }
                        }, 100)
                      }}
                    >
                      {(() => {
                        const draftId = currentDraft()?.id || 0
                        const storedLead = getDraftField(draftId, 'lead')

                        // Проблема здесь - storedLead может быть JSON объектом как строка
                        let finalLead = ''

                        try {
                          // Если storedLead начинается с {, это вероятно JSON
                          if (storedLead?.trim().startsWith('{')) {
                            const parsed = JSON.parse(storedLead)
                            // Извлекаем контент из JSON объекта
                            if (parsed && typeof parsed === 'object' && 'content' in parsed) {
                              finalLead = parsed.content || ''
                            }
                          } else {
                            // Иначе используем parseJsonContent
                            finalLead = parseJsonContent(storedLead || '') || currentDraft()?.lead || ''
                          }
                        } catch (e) {
                          console.error('[EditView] Error parsing lead content:', e)
                          // Если ошибка парсинга, используем fallback
                          finalLead = currentDraft()?.lead || ''
                        }

                        // Если finalLead всё еще JSON строка - пробуем извлечь контент последний раз
                        if (finalLead.trim().startsWith('{') && finalLead.includes('"content"')) {
                          try {
                            const lastAttempt = JSON.parse(finalLead)
                            if (
                              lastAttempt &&
                              typeof lastAttempt === 'object' &&
                              'content' in lastAttempt
                            ) {
                              finalLead = lastAttempt.content
                            }
                          } catch (_e) {
                            // Игнорируем ошибку, используем что есть
                          }
                        }

                        if (isEmptyContent(finalLead)) {
                          return null
                        }

                        console.log('[EditView] Lead preview content:', {
                          finalContent: finalLead.substring(0, 50)
                        })

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

  const [networkStatus, setNetworkStatus] = createSignal(navigator.onLine)

  onMount(() => {
    // Порядок регистрации обработчиков имеет значение 
    // Сначала регистрируем наш обработчик клика, затем onScroll и другие
    
    // Сначала добавляем локальные обработчики кликов, чтобы иметь возможность предотвратить всплытие
    const titleInput = document.querySelector(`.${styles.titleInput}`)
    if (titleInput) {
      titleInput.addEventListener('click', (e) => {
        console.log('[EditView] Direct title click handler')
        e.stopPropagation()
        setIsTitleClicked(true)
        
        // Явно предотвращаем действие по умолчанию
        e.preventDefault()
        return false
      }, { capture: true })
    }
    
    // Затем добавляем глобальный обработчик
    document.addEventListener('click', handleDocumentClick)
    
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('keydown', handleKeyDown)

    // Добавляем обработчики событий сети
    window.addEventListener('online', handleNetworkStatusChange)
    window.addEventListener('offline', handleNetworkStatusChange)

    // Устанавливаем начальное состояние сети
    setNetworkStatus(navigator.onLine)

    const draft = currentDraft()
    if (draft && draft?.id > 0) {
      // Проверяем, нужно ли восстановить локальные изменения
      restoreOfflineChanges(draft)

      // Если сеть доступна, подключаемся к awareness
      if (navigator.onLine) {
        initializeAwareness(draft)
      } else {
        console.log('[EditView] Network is offline, working in offline mode')
      }

      // Если есть несинхронизированные изменения и сеть доступна, синхронизируем их
      if (navigator.onLine && hasUnsyncedChanges(draft.id)) {
        syncOfflineChanges(draft)
      }
    }
  })

  // Обработчик изменения статуса сети
  const handleNetworkStatusChange = () => {
    setNetworkStatus(navigator.onLine)

    // Если сеть появилась, синхронизируем изменения
    const draft = currentDraft()
    if (navigator.onLine && draft?.id) {
      if (hasUnsyncedChanges(draft.id)) {
        console.log('[EditView] Network is back online, syncing offline changes')
        syncOfflineChanges(draft)
      }

      // Инициализируем awareness если он еще не был инициализирован
      if (getProvider().getConnectionState() !== 'connected') {
        console.log('[EditView] Network is back online, connecting to awareness')
        initializeAwareness(draft)
      }
    }
  }

  // Функция для инициализации awareness
  const initializeAwareness = (draft: Draft) => {
    try {
      // Получаем провайдер awareness
      const awarenessProvider = getProvider()

      // Подключаемся к существующему SSE соединению
      const { addHandler } = useConnect()

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

  const getContent = () => {
    // Получаем контент из локального хранилища или из draft
    const storedContent = getDraftField(currentDraft()?.id || 0, 'body')
    const draftContent = currentDraft()?.body || ''

    // Парсим содержимое с улучшенной обработкой кавычек
    const parsedContent = parseJsonContent(storedContent || '') || draftContent

    // Логируем для отладки
    console.log('[EditView] Body content initialization:', {
      storedContent: String(storedContent || '').substring(0, 100),
      draftContent: String(draftContent || '').substring(0, 100),
      parsedContent: String(parsedContent || '').substring(0, 100)
    })

    return parsedContent
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
                commands={featuredEditorCommands as readonly (CommandType | readonly CommandType[])[]}
                content={getContent()}
                onChange={(data) => handleInputChange('body', data)}
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
