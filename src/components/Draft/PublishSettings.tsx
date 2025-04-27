import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { Show, createEffect, createSignal, lazy, onCleanup, onMount } from 'solid-js'
import { createStore } from 'solid-js/store'
import { debounce } from 'throttle-debounce'
import {
  getDraftField,
  parseJsonContent,
  saveDraftField,
  updateLastSync
} from '~/components/SimpleRichEditor/lib/storage'
import {
  validateDraftForPublishing,
  validateDraftForSaving
} from '~/components/SimpleRichEditor/lib/validation'
import { UploadModalContent } from '~/components/Upload/UploadModalContent/UploadModalContent'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import { Image } from '~/components/_shared/Image'
import { InviteMembers } from '~/components/_shared/InviteMembers/InviteMembers'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useTopics } from '~/context/topics'
import { useUI } from '~/context/ui'
import { Author, DraftInput, Topic } from '~/graphql/schema/core.gen'
import { UploadedFile } from '~/types/upload'
import { Modal } from '../_shared/Modal'
import { TopicSelect } from '../_shared/TopicSelect'

import toast from 'solid-toast'
// TODO: should not be here, implement more components
import stylesBeside from '../Feed/Beside.module.scss'
import styles from './PublishSettings.module.scss'

const GrowingTextarea = lazy(() => import('~/components/_shared/GrowingTextarea/GrowingTextarea'))
const DESCRIPTION_MAX_LENGTH = 40
const EMPTY_TOPIC: Topic = { id: -1, slug: '' }
const EMPTY_FORM = {
  id: 0,
  layout: 'article',
  title: '',
  subtitle: '',
  lead: '',
  slug: '',
  body: '',
  cover: '',
  cover_caption: '',
  topics: [] as Topic[],
  mainTopic: EMPTY_TOPIC,
  seo: ''
} as FormType

const shorten = (str: string, maxLen: number) => {
  if (str.length <= maxLen) return str
  const result = str.slice(0, Math.max(0, str.lastIndexOf(' ', maxLen))).trim()
  return `${result}...`
}

// Тип формы для setter
type FormType = {
  id: number
  layout: 'article' | 'preface'
  title: string
  subtitle: string
  lead: string
  slug: string
  body: string
  cover: string
  cover_caption: string
  topics: Topic[]
  authors: Author[]
  mainTopic: Topic
  seo: string
}

// Расширенный тип для черновика, включающий дополнительные поля
interface ExtendedDraft extends DraftInput {
  topics?: Topic[]
  authors?: Author[]
}

/**
 * Загружает черновик с учетом локальных изменений
 * @param draftId ID черновика
 * @param draft Основной объект черновика
 * @returns Обновленный объект с примененными локальными изменениями
 */
function loadDraftWithOfflineChanges(draftId: number, draft: ExtendedDraft): FormType {
  try {
    // Получаем данные из localStorage
    const title = getDraftField(draftId, 'title') || draft.title || ''
    const subtitle = getDraftField(draftId, 'subtitle') || draft.subtitle || ''
    const slug = getDraftField(draftId, 'slug') || draft.slug || ''

    // Обрабатываем поля, которые могут содержать JSON
    const leadFromStorage = getDraftField(draftId, 'lead')
    const bodyFromStorage = getDraftField(draftId, 'body')

    // Десериализуем содержимое с учетом JSON формата
    const lead = parseJsonContent(leadFromStorage || '') || draft.lead || ''
    const body = parseJsonContent(bodyFromStorage || '') || draft.body || ''

    let topics: Topic[] = draft.topics || []
    let mainTopic: Topic = draft.topics?.[0] || EMPTY_TOPIC

    // Получаем topics из localStorage
    const topicsFromStorage = getDraftField(draftId, 'topics')
    if (topicsFromStorage) {
      try {
        console.log(
          `[PublishSettings] Загружаем topics из localStorage для черновика ${draftId}. Сырые данные:`,
          topicsFromStorage
        )

        // Проверяем формат данных перед JSON.parse
        if (typeof topicsFromStorage !== 'string') {
          console.warn(
            `[PublishSettings] Неверный формат topics в localStorage для черновика ${draftId}: ожидалась строка, получен ${typeof topicsFromStorage}`
          )
          topics = draft.topics || []
        } else if (topicsFromStorage.trim().startsWith('[')) {
          try {
            const parsedTopics = JSON.parse(topicsFromStorage)
            console.log(
              `[PublishSettings] Успешно распарсили JSON для topics черновика ${draftId}:`,
              parsedTopics
            )

            if (Array.isArray(parsedTopics)) {
              topics = parsedTopics
                .filter((topic) => {
                  if (!topic || typeof topic !== 'object' || !topic.id) {
                    console.warn(
                      `[PublishSettings] Обнаружен некорректный элемент в массиве topics: ${topic}`
                    )
                    return false
                  }
                  return true
                })
                .map((topic) => ({
                  id: Number(topic.id),
                  title: topic.title || '',
                  slug: topic.slug || '',
                  body: topic.body || null,
                  pic: topic.pic || null,
                  stat: topic.stat || null
                }))
              console.log(
                `[PublishSettings] Преобразовано ${topics.length} тем из JSON для черновика ${draftId}`
              )
            } else {
              console.warn(
                `[PublishSettings] topics распарсились, но это не массив для черновика ${draftId}:`,
                parsedTopics
              )
              topics = draft.topics || []
            }
          } catch (parseError) {
            console.error(
              `[PublishSettings] Критическая ошибка при парсинге topics из localStorage для черновика ${draftId}:`,
              parseError
            )
            // Дополнительная диагностика
            try {
              // Пытаемся определить проблему в JSON строке
              const problematicPart = topicsFromStorage.slice(0, 100) // Смотрим первые 100 символов
              console.warn(`[PublishSettings] Проблемная часть JSON в topics: ${problematicPart}`)
            } catch (e) {
              console.warn(`[PublishSettings] Не удалось проанализировать проблемную часть topics: ${e}`)
            }
            topics = draft.topics || []
          }
        } else {
          console.warn(
            `[PublishSettings] topics в localStorage не является массивом JSON для черновика ${draftId}:`,
            topicsFromStorage
          )
          topics = draft.topics || []
        }
      } catch (e) {
        console.error(
          `[PublishSettings] Общая ошибка обработки topics из localStorage для черновика ${draftId}:`,
          e
        )
        topics = draft.topics || []
      }
    }

    // Получаем mainTopic из localStorage
    const mainTopicFromStorage = getDraftField(draftId, 'mainTopic')
    if (mainTopicFromStorage) {
      try {
        console.log(
          `[PublishSettings] Загружаем mainTopic из localStorage для черновика ${draftId}. Сырые данные:`,
          mainTopicFromStorage
        )

        // Проверяем формат данных перед JSON.parse
        if (typeof mainTopicFromStorage !== 'string') {
          console.warn(
            `[PublishSettings] Неверный формат mainTopic в localStorage для черновика ${draftId}: ожидалась строка, получен ${typeof mainTopicFromStorage}`
          )
          mainTopic = extractTopicFromValue(draft.topics?.[0]) // Используем первую тему из черновика как mainTopic
        } else if (!mainTopicFromStorage.trim().startsWith('{') && mainTopicFromStorage.trim() !== 'null') {
          console.warn(
            `[PublishSettings] mainTopic в localStorage не является объектом JSON для черновика ${draftId}:`,
            mainTopicFromStorage
          )
          mainTopic = extractTopicFromValue(draft.topics?.[0]) // Используем первую тему из черновика как mainTopic
        } else {
          try {
            const parsedMainTopic = JSON.parse(mainTopicFromStorage)
            console.log(
              `[PublishSettings] Успешно распарсили JSON для mainTopic черновика ${draftId}:`,
              parsedMainTopic
            )

            if (parsedMainTopic === null) {
              mainTopic = draft.topics?.[0] || EMPTY_TOPIC
              console.log(`[PublishSettings] mainTopic установлен по первой теме для черновика ${draftId}`)
            } else if (
              typeof parsedMainTopic === 'object' &&
              parsedMainTopic !== null &&
              parsedMainTopic.id
            ) {
              mainTopic = {
                id: Number(parsedMainTopic.id),
                title: parsedMainTopic.title || '',
                slug: parsedMainTopic.slug || '',
                body: parsedMainTopic.body || null,
                pic: parsedMainTopic.pic || null,
                stat: parsedMainTopic.stat || null
              }
              console.log(
                `[PublishSettings] mainTopic установлен как объект с id ${mainTopic.id} для черновика ${draftId}`
              )
            } else {
              console.warn(
                `[PublishSettings] mainTopic распарсился, но имеет неверную структуру для черновика ${draftId}:`,
                parsedMainTopic
              )
              mainTopic = extractTopicFromValue(draft.topics?.[0]) // Используем первую тему из черновика как mainTopic
            }
          } catch (parseError) {
            console.error(
              `[PublishSettings] Критическая ошибка при парсинге mainTopic из localStorage для черновика ${draftId}:`,
              parseError
            )
            // Дополнительная диагностика
            try {
              // Пытаемся определить проблему в JSON строке
              const problematicPart = mainTopicFromStorage.slice(0, 100) // Смотрим первые 100 символов
              console.warn(`[PublishSettings] Проблемная часть JSON в mainTopic: ${problematicPart}`)
            } catch (e) {
              console.warn(`[PublishSettings] Не удалось проанализировать проблемную часть mainTopic: ${e}`)
            }
            mainTopic = extractTopicFromValue(draft.topics?.[0]) // Используем первую тему из черновика как mainTopic
          }
        }
      } catch (e) {
        console.error(
          `[PublishSettings] Общая ошибка обработки mainTopic из localStorage для черновика ${draftId}:`,
          e
        )
        mainTopic = extractTopicFromValue(draft.topics?.[0]) // Используем первую тему из черновика как mainTopic
      }
    }

    // Формируем и возвращаем обновленный объект
    const formData: FormType = {
      id: draftId,
      layout: (draft.layout || 'article') as 'article' | 'preface',
      title: title,
      subtitle: subtitle,
      lead: lead,
      slug: slug,
      body: body,
      cover: draft.cover || '',
      cover_caption: draft.cover_caption || '',
      topics: topics,
      mainTopic: mainTopic,
      authors: draft.authors || [],
      seo: draft.seo || ''
    }

    console.log('[PublishSettings] Loading draft with offline changes:', formData)
    return formData
  } catch (error) {
    console.error('[PublishSettings] Error loading draft with offline changes:', error)
    return {
      id: 0,
      layout: 'article',
      title: '',
      subtitle: '',
      lead: '',
      description: '',
      slug: '',
      body: '',
      cover: '',
      cover_caption: '',
      topics: [],
      mainTopic: EMPTY_TOPIC,
      authors: [],
      seo: ''
    } as FormType
  }
}

// Вспомогательная функция для подготовки объекта для updateDraft
const _prepareDraftUpdateObject = (draftData: FormType, leadContent: string, bodyContent: string) => {
  // Создаем базовый объект с правильными типами для updateDraft
  const result: {
    id: number
    layout: string
    title: string
    subtitle: string
    lead: string
    slug: string
    body: string
    cover: string
    cover_caption: string
    topic_ids: number[]
    main_topic_id?: number
    author_ids: number[]
  } = {
    id: draftData.id || 0,
    layout: draftData.layout || 'article',
    title: draftData.title || '',
    subtitle: draftData.subtitle || '',
    lead: leadContent, // Используем чистый контент
    slug: draftData.slug || '',
    body: bodyContent, // Используем чистый контент
    cover: draftData.cover || '',
    cover_caption: draftData.cover_caption || '',
    topic_ids: draftData.topics?.map((topic: Topic) => Number(topic.id)) || [],
    author_ids: []
  }

  // Добавляем main_topic_id если есть
  if (draftData?.mainTopic?.id && draftData?.mainTopic?.id > 0) {
    result.main_topic_id = Number(draftData.mainTopic.id)
  }

  return result
}

// Функция для извлечения объекта Topic из строки JSON или объекта
const extractTopicFromValue = (value: unknown): Topic => {
  if (!value) return EMPTY_TOPIC

  // Если это строка, пробуем распарсить JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      // Проверяем, что результат содержит необходимые поля Topic
      if (parsed?.id) {
        return {
          id: Number(parsed.id),
          slug: parsed.slug || '',
          title: parsed.title || '',
          // Добавляем другие необходимые поля Topic, если они есть
          body: parsed.body || null,
          pic: parsed.pic || null,
          stat: parsed.stat || null
        }
      }
    } catch (e) {
      console.error('[PublishSettings] Error parsing topic from JSON:', e)
    }
  }
  // Если это объект с полем id, возвращаем его как Topic
  else if (typeof value === 'object' && value !== null && 'id' in value) {
    const typedValue = value as {
      id: number | string
      slug?: string
      title?: string
      body?: string | null
      pic?: string | null
      stat?: {
        authors: number
        followers: number
        shouts: number
        comments?: number
      } | null
    }
    return {
      id: Number(typedValue.id),
      slug: typedValue.slug || '',
      title: typedValue.title || '',
      body: typedValue.body || null,
      pic: typedValue.pic || null,
      stat: typedValue.stat || null
    }
  }

  return EMPTY_TOPIC
}

// Функция для извлечения массива Topics из строки JSON или массива объектов
const extractTopicsFromValue = (value: unknown): Topic[] => {
  if (!value) return []

  // Если это строка, пробуем распарсить JSON
  if (typeof value === 'string') {
    try {
      console.log(`[PublishSettings] Parsing topics from string: ${value}`)
      const parsed = JSON.parse(value)

      // Если результат - массив, обрабатываем каждый элемент
      if (Array.isArray(parsed)) {
        console.log(`[PublishSettings] Found topic array with ${parsed.length} items`)
        return parsed
          .filter((item) => !!item && typeof item === 'object')
          .map((item) => extractTopicFromValue(item))
          .filter((topic) => topic.id !== EMPTY_TOPIC.id)
      }
      // Если результат - одиночный объект, возвращаем его как массив из одного элемента
      else if (parsed && typeof parsed === 'object' && parsed.id) {
        console.log(`[PublishSettings] Found single topic object: ${JSON.stringify(parsed)}`)
        const topic = extractTopicFromValue(parsed)
        return topic.id !== EMPTY_TOPIC.id ? [topic] : []
      }
    } catch (e) {
      console.error('[PublishSettings] Error parsing topics from JSON:', e)
      return []
    }
  }
  // Если это массив, обрабатываем каждый элемент
  else if (Array.isArray(value)) {
    console.log(`[PublishSettings] Processing array with ${value.length} topics`)
    return value
      .filter((item) => !!item && typeof item === 'object')
      .map((item) => extractTopicFromValue(item))
      .filter((topic) => topic.id !== EMPTY_TOPIC.id)
  }
  // Если это одиночный объект, возвращаем его как массив из одного элемента
  else if (typeof value === 'object' && value !== null && 'id' in value) {
    console.log('[PublishSettings] Processing single topic object')
    const topic = extractTopicFromValue(value)
    return topic.id !== EMPTY_TOPIC.id ? [topic] : []
  }

  console.warn(`[PublishSettings] Could not extract topics from value type: ${typeof value}`)
  return []
}

export const PublishSettings = () => {
  const { t } = useLocalize()
  const { currentDraft, publishDraft, syncDraft, updateDraft, unpublishShout } = useDrafts()
  const { showModal } = useUI()
  const { loadTopics, sortedTopics } = useTopics()
  const { session } = useSession()
  const navigate = useNavigate()
  const [coverImage, setCoverImage] = createSignal<UploadedFile | null>(null)
  const [isTopicsLoading, setIsTopicsLoading] = createSignal(true)
  const [isDirty, setIsDirty] = createSignal(false)
  const [form, setForm] = createStore(EMPTY_FORM)
  const [isLoading, setIsLoading] = createSignal(false)
  const [publishError, setPublishError] = createSignal<string | null>(null)
  const [coverUploadLoading, setCoverUploadLoading] = createSignal(false)
  const [savingDraft, setSavingDraft] = createSignal(false)

  const debouncedSaveToServer = debounce(2000, async () => {
    if (!isDirty()) return

    console.log('[PublishSettings] Auto-saving changes to server')
    const draft = currentDraft()
    if (!draft || !draft.id) return

    try {
      setSavingDraft(true)
      // Получаем данные из localStorage
      let leadContent = form.lead || ''
      let bodyContent = form.body || ''

      // Извлекаем контент из JSON если необходимо
      const leadFromStorage = getDraftField(draft.id, 'lead')
      const bodyFromStorage = getDraftField(draft.id, 'body')

      // Используем parseJsonContent для извлечения чистого контента
      leadContent = parseJsonContent(leadFromStorage || '') || leadContent
      bodyContent = parseJsonContent(bodyFromStorage || '') || bodyContent

      // Обрабатываем темы и главную тему
      const topicsField = getDraftField(draft.id, 'topics')
      const mainTopicField = getDraftField(draft.id, 'mainTopic')

      const topics = topicsField ? extractTopicsFromValue(topicsField) : form.topics
      const mainTopic = mainTopicField ? extractTopicFromValue(mainTopicField) : form.mainTopic

      // Создаем объект для updateDraft
      const draftToUpdate: DraftInput = {
        id: draft.id,
        layout: form.layout || 'article',
        title: form.title || '',
        subtitle: form.subtitle || '',
        lead: leadContent,
        slug: form.slug || '',
        body: bodyContent, // Используем извлеченный контент без JSON обертки
        cover: form.cover || '',
        cover_caption: form.cover_caption || '',
        // Передаем только массив id для топиков, безопасно проверяя, что topics - массив
        topic_ids: Array.isArray(topics)
          ? topics.map((topic) => Number(topic.id)).filter((id) => id > 0)
          : [],
        // Используем ID главной темы, если она задана
        main_topic_id: mainTopic?.id && mainTopic.id > 0 ? Number(mainTopic.id) : undefined
      }

      await updateDraft(draftToUpdate)

      // Обновляем время последней синхронизации в localStorage
      updateLastSync(draft.id)

      setIsDirty(false)
      console.log('[PublishSettings] Changes saved to server')
    } catch (error) {
      console.error('[PublishSettings] Error saving to server:', error)
    } finally {
      setSavingDraft(false)
    }
  })

  onCleanup(() => {
    debouncedSaveToServer.cancel()
  })

  const handleFieldChange = (key: string, value: string | number | boolean | Topic | Author) => {
    // Обновляем состояние формы
    setForm(key as keyof FormType, value as FormType[keyof FormType])
    setIsDirty(true)

    // Обрабатываем сохранение в localStorage
    const draft = currentDraft()
    if (draft?.id) {
      // Обрабатываем массив topics и объекты тем - должны быть преобразованы в JSON
      if (key === 'topics') {
        // Проверяем, является ли значение массивом Topic
        if (Array.isArray(value)) {
          // Создаем массив с минимально необходимыми данными для тем
          const topicsToSave = value.map((topic: Topic) => ({
            id: topic.id,
            slug: topic.slug || '',
            title: topic.title || ''
          }))
          saveDraftField(draft.id, key, JSON.stringify(topicsToSave))
          console.log(
            `[PublishSettings] Saved ${topicsToSave.length} topics to localStorage for draft ${draft.id}`
          )
        } else {
          console.warn('[PublishSettings] topics is not an array, cannot save properly')
        }
      }
      // Для mainTopic и других объектных типов также используем JSON.stringify
      else if (key === 'mainTopic' && value && typeof value === 'object') {
        const mainTopicToSave = {
          id: (value as Topic).id,
          slug: (value as Topic).slug || '',
          title: (value as Topic).title || ''
        }
        saveDraftField(draft.id, key, JSON.stringify(mainTopicToSave))
      }
      // Для остальных типов полей используем обычное сохранение
      else {
        saveDraftField(draft.id, key, String(value))
      }
      console.log(`[PublishSettings] Saved field ${key} to localStorage for draft ${draft.id}`)
    }

    // Запускаем дебаунсированное сохранение на сервер
    debouncedSaveToServer()
  }

  const loadLatestDraftData = async () => {
    const draft = currentDraft()
    if (!draft || !draft.id) return

    try {
      console.log('[PublishSettings] Syncing draft data for ID:', draft.id)

      // Синхронизируем черновик с сервером и localStorage
      const syncedDraft = await syncDraft(draft.id)
      console.log('[PublishSettings] Synced draft data:', syncedDraft)

      // Проверяем, успешно ли прошла синхронизация
      if (!syncedDraft) {
        console.warn('[PublishSettings] Failed to sync draft, using current draft data')

        // Проверяем, что draft имеет все необходимые поля
        if (draft?.id) {
          // Если синхронизация не удалась, используем loadDraftWithOfflineChanges как резервный вариант
          const draftData = loadDraftWithOfflineChanges(draft.id, draft as ExtendedDraft)
          if (draftData) {
            setForm({
              ...draftData,
              authors: (draft.authors || []) as Author[],
              mainTopic: draft.topics?.[0] || EMPTY_TOPIC,
              topics: draft.topics
                ? Array.isArray(draft.topics)
                  ? draft.topics.filter((topic): topic is Topic => !!topic && !!topic.id)
                  : []
                : []
            } as FormType)
          } else {
            // Крайний случай: используем данные как есть
            console.warn('[PublishSettings] Using fallback draft data without sync')
            setForm({
              id: draft.id,
              layout: (draft.layout || 'article') as 'article' | 'preface',
              title: draft.title || '',
              subtitle: draft.subtitle || '',
              lead: draft.lead || '',
              slug: draft.slug || '',
              body: draft.body || '',
              cover: draft.cover || '',
              cover_caption: draft.cover_caption || '',
              topics: draft.topics
                ? Array.isArray(draft.topics)
                  ? draft.topics.filter((topic): topic is Topic => !!topic && !!topic.id)
                  : []
                : [],
              mainTopic: draft.topics?.[0] || EMPTY_TOPIC
            })
          }
        }
        return
      }

      // Проверяем, что syncedDraft имеет все необходимые поля
      if (syncedDraft?.id) {
        // Применяем все локальные изменения поверх синхронизированного черновика
        const draftData = loadDraftWithOfflineChanges(draft.id, syncedDraft as ExtendedDraft)
        if (draftData) {
          setForm({
            ...draftData,
            authors: (syncedDraft.authors || []) as Author[],
            mainTopic: syncedDraft.topics?.[0] || EMPTY_TOPIC,
            topics: syncedDraft.topics
              ? Array.isArray(syncedDraft.topics)
                ? syncedDraft.topics.filter((topic): topic is Topic => !!topic && !!topic.id)
                : []
              : []
          } as FormType)
          console.log('[PublishSettings] Form updated with synced and local data:', draftData)
        } else {
          // Используем только синхронизированный черновик
          setForm({
            id: syncedDraft.id,
            layout: (syncedDraft.layout || 'article') as 'article' | 'preface',
            title: syncedDraft.title || '',
            subtitle: syncedDraft.subtitle || '',
            lead: syncedDraft.lead || '',
            slug: syncedDraft.slug || '',
            body: syncedDraft.body || '',
            cover: syncedDraft.cover || '',
            cover_caption: syncedDraft.cover_caption || '',
            topics: syncedDraft.topics
              ? Array.isArray(syncedDraft.topics)
                ? syncedDraft.topics.filter((topic): topic is Topic => !!topic && !!topic.id)
                : []
              : [],
            mainTopic: syncedDraft.topics?.[0] || EMPTY_TOPIC
          })
        }
      }
    } catch (error) {
      console.error('[PublishSettings] Error loading latest draft data:', error)

      // Проверяем, что draft имеет все необходимые поля
      if (draft?.id) {
        // В случае ошибки используем резервный вариант
        const draftData = loadDraftWithOfflineChanges(draft.id, draft as ExtendedDraft)
        if (draftData) {
          setForm({
            ...draftData,
            authors: (draft.authors || []) as Author[],
            mainTopic: draft.topics?.[0] || EMPTY_TOPIC,
            topics: draft.topics
              ? Array.isArray(draft.topics)
                ? draft.topics.filter((topic): topic is Topic => !!topic && !!topic.id)
                : []
              : []
          } as FormType)
        }
      }
    }
  }

  onMount(async () => {
    // При монтировании компонента, загружаем последние данные
    await loadLatestDraftData()

    // Инициализируем сигнал coverImage значением из формы
    if (form.cover) {
      setCoverImage({ url: form.cover } as UploadedFile)
    }

    // Загружаем темы для селектора
    setIsTopicsLoading(true)
    try {
      await loadTopics()
    } catch (error) {
      console.error('[PublishSettings] Error loading topics:', error)
    } finally {
      setIsTopicsLoading(false)
    }
  })

  const _composeDescription = () => {
    // Функция для удаления HTML тегов из текста
    const stripHtml = (html: string) => {
      return html
        .replace(/<footnote[^>]*>.*?<\/footnote>/g, '') // Удаляем footnote теги с содержимым
        .replace(/<[^>]+>/g, ' ') // Заменяем все HTML теги на пробелы
        .replace(/\s+/g, ' ') // Нормализуем пробелы
        .trim() // Убираем лишние пробелы в начале и конце
    }

    // Затем проверяем наличие вступления (lead) и используем его
    if (form.lead) {
      const cleanLeadText = stripHtml(form.lead)
      return shorten(cleanLeadText, DESCRIPTION_MAX_LENGTH)
    }

    // Если нет ни описания, ни вступления, используем начало основного текста
    if (form.body) {
      const cleanBodyText = stripHtml(form.body)
      return shorten(cleanBodyText, DESCRIPTION_MAX_LENGTH)
    }

    return ''
  }

  const handleUploadModalContentCloseSetCover = (image: UploadedFile | undefined) => {
    showModal('uploadCoverImage')
    setCoverUploadLoading(true)

    // Имитация задержки загрузки
    setTimeout(() => {
      // Обновляем сигнал coverImage
      setCoverImage(image || null)
      // Синхронизируем со значением в форме
      handleFieldChange('cover', image?.url || '')
      setCoverUploadLoading(false)
    }, 300)
  }

  const handleDeleteCoverImage = () => {
    // Очищаем сигнал coverImage
    setCoverImage(null)
    // Синхронизируем со значением в форме
    handleFieldChange('cover', '')
  }

  const handleTopicSelectChange = (newSelectedTopics: Topic[]) => {
    // Обновляем выбранные темы в форме
    if (newSelectedTopics.length > 0) {
      setForm('topics', newSelectedTopics)
      setIsDirty(true)

      // Сохраняем topics в localStorage с минимальными данными
      const draft = currentDraft()
      if (draft?.id) {
        // Создаем массив с минимально необходимыми данными для тем
        const topicsToSave = newSelectedTopics.map((topic) => ({
          id: topic.id,
          slug: topic.slug,
          title: topic.title
        }))

        saveDraftField(draft.id, 'topics', JSON.stringify(topicsToSave))
        console.log(
          `[PublishSettings] Saved ${topicsToSave.length} topics to localStorage for draft ${draft.id}`
        )
      }
    } else {
      // Если темы не выбраны, устанавливаем пустой массив
      setForm('topics', [])
      setIsDirty(true)
    }

    // Обновляем главную тему, только если это первая выбранная тема или главная тема не задана
    const currentTopics = form.topics || []
    const isFirstTopic = currentTopics.length === 0 && newSelectedTopics.length > 0
    const isMainTopicEmpty = !form.mainTopic || form.mainTopic.id === EMPTY_TOPIC.id

    if (isFirstTopic || isMainTopicEmpty) {
      if (newSelectedTopics.length > 0) {
        const newMainTopic = newSelectedTopics[0]
        setForm('mainTopic', newMainTopic)

        // Сохраняем mainTopic в localStorage
        const draft = currentDraft()
        if (draft?.id) {
          // Сохраняем только необходимые поля темы
          const mainTopicToSave = {
            id: newMainTopic.id,
            slug: newMainTopic.slug,
            title: newMainTopic.title
          }
          saveDraftField(draft.id, 'mainTopic', JSON.stringify(mainTopicToSave))
          console.log(`[PublishSettings] Saved mainTopic to localStorage for draft ${draft.id}`)
        }
      }
    }

    // Запускаем дебаунсированное сохранение на сервер только один раз в конце
    debouncedSaveToServer()
  }

  const handleBackClick = () => {
    navigate(`/edit/${currentDraft()?.id}`)
  }
  const handleCancelClick = () => {
    const currentDraftData = currentDraft()
    setForm({
      id: currentDraftData?.id || 0,
      layout: (currentDraftData?.layout || 'article') as 'article' | 'preface',
      title: currentDraftData?.title || '',
      subtitle: currentDraftData?.subtitle || '',
      lead: currentDraftData?.lead || '',
      slug: currentDraftData?.slug || '',
      body: currentDraftData?.body || '',
      cover: currentDraftData?.cover || '',
      cover_caption: currentDraftData?.cover_caption || '',
      topics: (currentDraftData?.topics as Topic[]) || [],
      mainTopic: currentDraftData?.topics?.[0] || EMPTY_TOPIC
    })
    handleBackClick()
  }

  const handlePublishSubmit = async () => {
    try {
      const draftInput: DraftInput = {
        id: form.id,
        layout: form.layout || 'article',
        title: form.title || '',
        subtitle: form.subtitle || '',
        lead: form.lead || '',
        body: form.body || '',
        slug: form.slug || '',
        cover: form.cover || '',
        cover_caption: form.cover_caption || '',
        topic_ids: form.topics?.map((t) => t.id) || [],
        main_topic_id: form.mainTopic?.id || null,
        seo: form.seo || ''
      }

      // Валидация перед публикацией
      const validationResult = validateDraftForPublishing(draftInput)
      if (!validationResult.isValid) {
        const errorMessages = validationResult.errors.map((err) => err.message).join('\n')
        setPublishError(errorMessages)
        return
      }

      // Публикация если валидация прошла успешно
      const result = await publishDraft(form.id)
      if (result?.data?.publish_draft?.draft) {
        toast.success(t('Draft published successfully'))
        navigate(`/${result.data.publish_draft.draft.slug}`)
      }
    } catch (error) {
      console.error('[PublishSettings] Error publishing draft:', error)
      setPublishError(error instanceof Error ? error.message : t('Unknown error occurred'))
    }
  }

  const handleSaveDraft = () => {
    if (isLoading() || savingDraft()) return
    try {
      setSavingDraft(true)
      const draftInput: DraftInput = {
        id: form.id,
        layout: form.layout || 'article',
        title: form.title || '',
        subtitle: form.subtitle || '',
        lead: form.lead || '',
        body: form.body || '',
        slug: form.slug || '',
        cover: form.cover || '',
        cover_caption: form.cover_caption || '',
        topic_ids: form.topics?.map((t) => t.id) || [],
        main_topic_id: form.mainTopic?.id || null,
        seo: form.seo || ''
      }

      // Валидация перед сохранением
      const validationResult = validateDraftForSaving(draftInput)
      if (!validationResult.isValid) {
        const errorMessages = validationResult.errors.map((err) => err.message).join('\n')
        toast.error(errorMessages)
        return
      }

      // Сохранение если валидация прошла успешно
      saveDraftField(form.id, 'title', form.title)
      saveDraftField(form.id, 'subtitle', form.subtitle)
      saveDraftField(form.id, 'lead', form.lead)
      saveDraftField(form.id, 'body', form.body)
      saveDraftField(form.id, 'slug', form.slug)
      saveDraftField(form.id, 'cover', form.cover)
      saveDraftField(form.id, 'cover_caption', form.cover_caption)
      saveDraftField(form.id, 'topics', JSON.stringify(form.topics))
      saveDraftField(form.id, 'mainTopic', JSON.stringify(form.mainTopic))
      saveDraftField(form.id, 'seo', form.seo)

      updateLastSync(form.id)
      toast.success(t('Draft saved successfully'))
      setSavingDraft(false)
    } catch (error) {
      console.error('[PublishSettings] Error saving draft:', error)
      toast.error(error instanceof Error ? error.message : t('Unknown error occurred'))
      setSavingDraft(false)
    }
  }

  const removeSpecial = (ev: InputEvent) => {
    const input = ev.target as HTMLInputElement
    const value = input.value
    const newValue = value.startsWith('@') || value.startsWith('!') ? value.substring(1) : value
    input.value = newValue
  }
  const [editingTitle, setEditingTitle] = createSignal(false)
  const [editingSubtitle, setEditingSubtitle] = createSignal(false)
  const [editingTeaser, setEditingTeaser] = createSignal(false) // Shout.seo

  // Показываем toast при ошибке публикации
  createEffect(() => {
    const err = publishError()
    if (err) {
      toast.error(typeof err === 'string' ? err : t('Error'))
    }
  })

  // Добавляем функцию для определения статуса публикации
  const isPublished = () => {
    const draft = currentDraft()
    return draft?.published_at != null && draft?.published_at > 0
  }

  // Добавляем обработчик для снятия с публикации
  const handleUnpublish = async () => {
    try {
      setIsLoading(true)
      const draft = currentDraft()
      if (!draft?.id) return

      const result = await unpublishShout(draft.id)
      if (result?.data?.unpublish_shout) {
        toast.success(t('Article unpublished successfully'))
        // После снятия с публикации обновляем данные
        await loadLatestDraftData()
      }
    } catch (error) {
      console.error('[PublishSettings] Error unpublishing article:', error)
      toast.error(error instanceof Error ? error.message : t('Unknown error occurred'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form class={clsx(styles.PublishSettings, 'inputs-wrapper')}>
      <div class="wide-container">
        <div class="row">
          <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
            <div>
              <button type="button" class={styles.goBack} onClick={handleBackClick}>
                <Icon name="arrow-left" class={stylesBeside.icon} />
                {t('Back to editor')}
              </button>
            </div>
            <h1>{t('Publish Settings')}</h1>
            <h4>{t('Material card')}</h4>
            <div class={styles.articlePreview}>
              <div class={styles.actions}>
                <Button
                  variant="primary"
                  onClick={() => showModal('uploadCoverImage')}
                  value={coverImage() ? t('Add another image') : t('Add image')}
                  disabled={coverUploadLoading()}
                />
                <Show when={coverImage()}>
                  <Button
                    variant="secondary"
                    onClick={handleDeleteCoverImage}
                    value={t('Delete cover')}
                    disabled={coverUploadLoading()}
                  />
                </Show>
              </div>
              <div
                class={clsx(styles.shoutCardCoverContainer, {
                  [styles.hasImage]: coverImage(),
                  [styles.loading]: coverUploadLoading()
                })}
              >
                <Show when={coverImage()}>
                  <div class={styles.shoutCardCover}>
                    <Image src={coverImage()?.url || ''} alt={form.title || ''} width={800} />
                  </div>
                </Show>
                <div class={styles.text}>
                  <Show when={form.mainTopic}>
                    <div class={styles.mainTopic}>{form.mainTopic?.title || ''}</div>
                  </Show>
                  <Show
                    when={editingTitle()}
                    fallback={
                      <div onClick={() => setEditingTitle(true)} class={styles.shoutCardTitle}>
                        {form.title}
                      </div>
                    }
                  >
                    <GrowingTextarea
                      allowEnterKey={true}
                      class={styles.lyrics}
                      placeholder={t('Title')}
                      onChange={(value: string) => handleFieldChange('title', value)}
                      initialValue={form.title || ''}
                    />
                  </Show>
                  <Show
                    when={editingSubtitle()}
                    fallback={
                      <div onClick={() => setEditingSubtitle(true)} class={styles.shoutCardSubtitle}>
                        {form.subtitle || ''}
                      </div>
                    }
                  >
                    <GrowingTextarea
                      allowEnterKey={true}
                      class={styles.lyrics}
                      placeholder={t('Subtitle')}
                      onChange={(value: string) => handleFieldChange('subtitle', value)}
                      initialValue={form.subtitle || ''}
                    />
                  </Show>

                  <Show
                    when={editingTeaser()}
                    fallback={
                      <div onClick={() => setEditingTeaser(true)} class={styles.shoutCardTeaser}>
                        {form.subtitle || ''}
                      </div>
                    }
                  >
                    <GrowingTextarea
                      allowEnterKey={true}
                      class={styles.lyrics}
                      placeholder={t('Teaser')}
                      onChange={(value: string) => handleFieldChange('seo', value)}
                      initialValue={form.seo || ''}
                    />
                  </Show>
                  <div class={styles.shoutAuthor}>
                    {session()?.user?.app_data?.profile?.name || t('Anonymous')}
                  </div>
                </div>
              </div>
            </div>
            <p class="description">
              {t(
                'Choose a title image for the article. You can immediately see how the publication card will look like.'
              )}
            </p>

            <h4>{t('Slug')}</h4>
            <div class="pretty-form__item">
              <input
                type="text"
                name="slug"
                id="slug"
                value={form.slug}
                onInput={(e) => {
                  removeSpecial(e)
                  const input = e.target as HTMLInputElement
                  handleFieldChange('slug', input.value)
                }}
              />
            </div>

            <h4>{t('Topics')}</h4>
            <p class="description">
              {t(
                'Add a few topics so that the reader knows what your content is about and can find it on pages of topics that interest them. Topics can be swapped, the first topic becomes the title'
              )}
            </p>
            <div class={styles.inputContainer}>
              <div class={clsx('pretty-form__item', styles.topicSelectContainer)}>
                <Show
                  when={!isTopicsLoading()}
                  fallback={<div class="loading-indicator">{t('Loading topics...')}</div>}
                >
                  <TopicSelect
                    topics={sortedTopics()}
                    onChange={handleTopicSelectChange}
                    selectedTopics={form.topics || []}
                    onMainTopicChange={(mainTopic) => {
                      setForm('mainTopic', mainTopic)
                      setIsDirty(true)

                      // Сохраняем mainTopic в localStorage
                      const draft = currentDraft()
                      if (draft?.id) {
                        // Сохраняем только необходимые поля темы, чтобы избежать проблем сериализации
                        const mainTopicToSave = {
                          id: mainTopic.id,
                          slug: mainTopic.slug || '',
                          title: mainTopic.title || ''
                        }
                        saveDraftField(draft.id, 'mainTopic', JSON.stringify(mainTopicToSave))
                        console.log(
                          `[PublishSettings] Saved mainTopic to localStorage for draft ${draft.id}`
                        )

                        // Запускаем дебаунсированное сохранение на сервер
                        debouncedSaveToServer()
                      }
                    }}
                    mainTopic={form.mainTopic}
                  />
                </Show>
              </div>
            </div>
            <h4>{t('Collaborators')}</h4>
            <Button
              variant="primary"
              onClick={() => showModal('inviteMembers')}
              value={t('Invite collaborators')}
            />
          </div>
        </div>
      </div>

      <div class={styles.formActions}>
        <div class="wide-container">
          <div class="row">
            <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
              <div class={styles.content}>
                <Show
                  when={!isPublished()}
                  fallback={
                    <Button
                      variant="primary"
                      onClick={handleUnpublish}
                      value={isLoading() ? t('Unpublishing...') : t('Unpublish')}
                      disabled={isLoading() || savingDraft()}
                    />
                  }
                >
                  <Button
                    variant="light"
                    value={t('Cancel changes')}
                    class={styles.cancel}
                    onClick={handleCancelClick}
                    disabled={isLoading() || savingDraft()}
                  />
                  <Button
                    variant="secondary"
                    onClick={handleSaveDraft}
                    value={savingDraft() ? t('Saving...') : t('Save draft')}
                    disabled={isLoading() || savingDraft()}
                  />
                  <Button
                    onClick={handlePublishSubmit}
                    variant="primary"
                    value={isLoading() ? t('Publishing...') : t('Publish')}
                    disabled={isLoading() || savingDraft()}
                  />
                </Show>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Modal variant="narrow" name="uploadCoverImage">
        <UploadModalContent
          onClose={(value: UploadedFile | undefined) =>
            handleUploadModalContentCloseSetCover(value as UploadedFile)
          }
        />
      </Modal>
      <Modal variant="medium" name="inviteMembers">
        <InviteMembers variant={'coauthors'} title={t('Invite collaborators')} />
      </Modal>
    </form>
  )
}
