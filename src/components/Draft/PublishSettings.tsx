import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { Show, createSignal, lazy, onMount } from 'solid-js'
import { createStore } from 'solid-js/store'
import { SimpleRichEditor } from '~/components/SimpleRichEditor/SimpleRichEditor'
import {
  applyOfflineChanges,
  getAllDraftFields,
  getDraftField
} from '~/components/SimpleRichEditor/lib/storage'
import { UploadModalContent } from '~/components/Upload/UploadModalContent/UploadModalContent'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import { Image } from '~/components/_shared/Image'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useTopics } from '~/context/topics'
import { useSnackbar, useUI } from '~/context/ui'
import { Maybe, Topic } from '~/graphql/schema/core.gen'
import { UploadedFile } from '~/types/upload'
import { EditorData } from '../SimpleRichEditor/lib/types'
import { Modal } from '../_shared/Modal'
import { TopicSelect } from '../_shared/TopicSelect'

// TODO: should not be here, implement more components
import stylesBeside from '../Feed/Beside.module.scss'
import styles from './PublishSettings.module.scss'

const GrowingTextarea = lazy(() => import('~/components/_shared/GrowingTextarea/GrowingTextarea'))
const DESCRIPTION_MAX_LENGTH = 40
const EMPTY_TOPIC: Topic = { id: -1, slug: '' }

const shorten = (str: string, maxLen: number) => {
  if (str.length <= maxLen) return str
  const result = str.slice(0, Math.max(0, str.lastIndexOf(' ', maxLen))).trim()
  return `${result}...`
}

// Тип для объекта черновика при работе с localStorage
interface DraftDataObject {
  id: number
  layout?: string | null
  title?: string | null
  subtitle?: string | null
  lead?: string | null
  description?: string | null
  slug?: string | null
  body?: string | null
  cover?: string | null
  cover_caption?: string | null
  topics?: Maybe<Maybe<Topic>[]>
  [key: string]: unknown
}

// Тип формы для setter
type FormType = {
  id: number
  layout: 'article' | 'preface'
  title: string
  subtitle: string
  lead: string
  description: string
  slug: string
  body: string
  cover: string
  cover_caption: string
  topics: Topic[]
  mainTopic: Topic
}

// Преобразование draft в формат DraftDataObject
const draftToDraftDataObject = (draft: unknown): DraftDataObject => {
  if (!draft || typeof draft !== 'object') return { id: 0 }
  const draftObj = draft as Record<string, unknown>
  if (!draftObj.id) return { id: 0 }
  return draft as DraftDataObject
}

// Функция для загрузки данных черновика с учетом локального хранилища и базы данных
const loadDraftWithOfflineChanges = (_draftId: number, draft: DraftDataObject) => {
  if (!draft || !draft.id) return null

  try {
    // Получаем оффлайн-изменения
    const offlineFields = getAllDraftFields(draft.id)
    console.log('[PublishSettings] Checking offline fields:', offlineFields)

    // Получаем актуальное содержимое из localStorage
    const bodyContent = getDraftField(draft.id, 'body') || draft.body || ''
    const leadContent = getDraftField(draft.id, 'lead') || draft.lead || ''
    const titleContent = getDraftField(draft.id, 'title') || draft.title || ''
    const subtitleContent = getDraftField(draft.id, 'subtitle') || draft.subtitle || ''
    const descriptionContent = getDraftField(draft.id, 'description') || draft.description || ''
    const slugContent = getDraftField(draft.id, 'slug') || draft.slug || ''

    // Применяем оффлайн-изменения к черновику
    const updatedDraft = applyOfflineChanges(draft.id, draft)

    // Создаем объект для обновления формы с приоритетом на локальные изменения
    const formData = {
      id: draft.id,
      layout: updatedDraft.layout || 'article',
      title: titleContent || updatedDraft.title || '',
      subtitle: subtitleContent || updatedDraft.subtitle || '',
      lead: leadContent || updatedDraft.lead || '',
      description: descriptionContent || updatedDraft.description || '',
      slug: slugContent || updatedDraft.slug || '',
      body: bodyContent || updatedDraft.body || '',
      cover: updatedDraft.cover || '',
      cover_caption: updatedDraft.cover_caption || '',
      topics: updatedDraft.topics
        ? updatedDraft.topics.filter((topic): topic is Topic => !!topic && !!topic.id)
        : [],
      mainTopic: updatedDraft.topics?.[0] || EMPTY_TOPIC
    }

    console.log('[PublishSettings] Loading draft with offline changes:', formData)
    return formData
  } catch (error) {
    console.error('[PublishSettings] Error loading draft with offline changes:', error)
    return null
  }
}

export const PublishSettings = () => {
  const { t } = useLocalize()
  const { drafts, currentDraft, setCurrentDraft, publishDraft, syncDraft } = useDrafts()
  const { showSnackbar } = useSnackbar()
  const { showModal } = useUI()
  const [_isPublishing, _setIsPublishing] = createSignal(false)
  const [_selectedTopicId, _setSelectedTopicId] = createSignal<number | null>(null)
  const { loadTopics, sortedTopics } = useTopics()
  const { session } = useSession()
  const navigate = useNavigate()
  const [_coverImage, _setCoverImage] = createSignal<UploadedFile | null>(null)
  const [form, setForm] = createStore({
    id: 0,
    layout: 'article' as 'article' | 'preface',
    title: '',
    subtitle: '',
    lead: '',
    description: '',
    slug: '',
    body: '',
    cover: '',
    cover_caption: '',
    topics: [] as Topic[],
    mainTopic: EMPTY_TOPIC
  })

  // Функция для принудительной синхронизации и загрузки последних данных черновика
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
          const draftData = loadDraftWithOfflineChanges(draft.id, draftToDraftDataObject(draft))
          if (draftData) {
            setForm(draftData as FormType)
          } else {
            // Крайний случай: используем данные как есть
            console.warn('[PublishSettings] Using fallback draft data without sync')
            setForm({
              id: draft.id,
              layout: (draft.layout || 'article') as 'article' | 'preface',
              title: draft.title || '',
              subtitle: draft.subtitle || '',
              lead: draft.lead || '',
              description: draft.description || '',
              slug: draft.slug || '',
              body: draft.body || '',
              cover: draft.cover || '',
              cover_caption: draft.cover_caption || '',
              topics: draft.topics
                ? draft.topics.filter((topic): topic is Topic => !!topic && !!topic.id)
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
        const draftData = loadDraftWithOfflineChanges(draft.id, draftToDraftDataObject(syncedDraft))
        if (draftData) {
          setForm(draftData as FormType)
          console.log('[PublishSettings] Form updated with synced and local data:', draftData)
        } else {
          // Используем только синхронизированный черновик
          setForm({
            id: syncedDraft.id,
            layout: (syncedDraft.layout || 'article') as 'article' | 'preface',
            title: syncedDraft.title || '',
            subtitle: syncedDraft.subtitle || '',
            lead: syncedDraft.lead || '',
            description: syncedDraft.description || '',
            slug: syncedDraft.slug || '',
            body: syncedDraft.body || '',
            cover: syncedDraft.cover || '',
            cover_caption: syncedDraft.cover_caption || '',
            topics: syncedDraft.topics
              ? syncedDraft.topics.filter((topic): topic is Topic => !!topic && !!topic.id)
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
        const draftData = loadDraftWithOfflineChanges(draft.id, draftToDraftDataObject(draft))
        if (draftData) {
          setForm(draftData as FormType)
        }
      }
    }
  }

  onMount(async () => {
    // При монтировании компонента, загружаем последние данные
    await loadLatestDraftData()

    // Загружаем темы для селектора
    await loadTopics()
  })

  const composeDescription = () => {
    // Приоритетно используем описание, если оно уже задано
    if (form.description) {
      return form.description
    }

    // Затем проверяем наличие вступления (lead) и используем его
    if (form.lead) {
      const cleanLeadText = form.lead?.replaceAll(/<\/?[^>]+(>|$)/gi, ' ') || ''
      return shorten(cleanLeadText, DESCRIPTION_MAX_LENGTH).trim()
    }

    // Если нет ни описания, ни вступления, используем начало основного текста
    const cleanBodyText =
      form.body
        ?.replaceAll(/<footnote data-value=".*?">(.*?)<\/footnote>/g, '')
        ?.replaceAll(/<\/?[^>]+(>|$)/gi, ' ') || ''

    return shorten(cleanBodyText, DESCRIPTION_MAX_LENGTH).trim()
  }

  const handleUploadModalContentCloseSetCover = (image: UploadedFile | undefined) => {
    showModal('uploadCoverImage')
    setForm('cover', image?.url || '')
  }
  const handleDeleteCoverImage = () => {
    setForm('cover', '')
  }

  const handleTopicSelectChange = (newSelectedTopics: Topic[]) => {
    if (
      currentDraft()?.topics?.length === 0 ||
      newSelectedTopics.every((topic: Topic) => topic.id !== currentDraft()?.topics?.[0]?.id)
    ) {
      setForm((prev) => {
        return {
          ...prev,
          mainTopic: newSelectedTopics[0]
        }
      })
    }

    if (newSelectedTopics.length > 0) {
      setForm('topics', newSelectedTopics)
    }
  }

  const handleBackClick = () => {
    navigate(`/edit/${currentDraft()?.id}`)
  }
  const handleCancelClick = () => {
    const currentDraftData = currentDraft() as unknown as DraftDataObject
    setForm({
      id: currentDraftData.id || 0,
      layout: (currentDraftData.layout || 'article') as 'article' | 'preface',
      title: currentDraftData.title || '',
      subtitle: currentDraftData.subtitle || '',
      lead: currentDraftData.lead || '',
      description: currentDraftData.description || '',
      slug: currentDraftData.slug || '',
      body: currentDraftData.body || '',
      cover: currentDraftData.cover || '',
      cover_caption: currentDraftData.cover_caption || '',
      topics: currentDraftData.topics
        ? currentDraftData.topics.filter((topic): topic is Topic => !!topic && !!topic.id)
        : [],
      mainTopic: currentDraftData.topics?.[0] || EMPTY_TOPIC
    })
    handleBackClick()
  }

  const handlePublishSubmit = () => {
    const draft = drafts().find((d) => d.id === currentDraft()?.id)
    console.group('[handlePublishSubmit]')

    // Получаем самые свежие данные из localStorage и редакторов
    const formData = loadDraftWithOfflineChanges(currentDraft()?.id || 0, currentDraft() as DraftDataObject)

    // Объединяем все данные из разных источников с приоритетом на локальные изменения
    const updatedDraft = {
      ...currentDraft(),
      ...(formData || {}), // Если formData есть, используем его
      ...form, // Потом применяем изменения из формы настроек
      ...(draft || {}) // В конце добавляем данные из глобального состояния
    }

    console.log('updating draft: ', updatedDraft)

    // Гарантируем, что все поля из формы будут сохранены даже если не все поля
    // были в formData или в существующих записях черновика
    const draftToUpdate = {
      id: updatedDraft.id,
      layout: updatedDraft.layout || 'article',
      title: form.title || updatedDraft.title || '',
      subtitle: form.subtitle || updatedDraft.subtitle || '',
      lead: form.lead || updatedDraft.lead || '',
      description: form.description || updatedDraft.description || '',
      slug: form.slug || updatedDraft.slug || '',
      body: updatedDraft.body || '',
      cover: form.cover || updatedDraft.cover || '',
      cover_caption: form.cover_caption || updatedDraft.cover_caption || '',
      topics: form.topics || updatedDraft.topics || [],
      mainTopic: form.mainTopic || updatedDraft.mainTopic
    }

    // Отправляем на сервер с гарантированно заполненными полями
    const currentDraftObj = currentDraft()
    if (currentDraftObj?.created_by) {
      const draftWithRequiredFields = {
        ...draftToUpdate,
        created_at: currentDraftObj.created_at || Math.floor(Date.now() / 1000),
        created_by: currentDraftObj.created_by
      }
      setCurrentDraft(draftWithRequiredFields)
    } else {
      console.error('[handlePublishSubmit] Missing created_by field in draft')
    }

    console.log('Publishing data:', draftToUpdate)

    // Проверяем наличие выбранных топиков
    const hasValidTopics =
      (draftToUpdate.topics || []).length > 0 ||
      (draftToUpdate.mainTopic?.id && draftToUpdate.mainTopic.id > 0)

    console.log('Topics validation:', {
      selectedTopics: draftToUpdate.topics,
      mainTopic: draftToUpdate.mainTopic,
      hasValidTopics
    })

    if (hasValidTopics) {
      console.log('Topics validation passed, proceeding with publication')
      publishDraft(draftToUpdate.id || -1)
    } else {
      console.warn('Publication rejected: no valid topics')
      showSnackbar({ body: t('Please, select at least one topic') })
    }
    console.groupEnd()
  }

  const handleSaveDraft = () => {
    // Аналогично handlePublishSubmit, но без публикации
    const draft = drafts().find((d) => d.id === currentDraft()?.id)

    // Получаем свежие данные из localStorage
    const formData = loadDraftWithOfflineChanges(currentDraft()?.id || 0, currentDraft() as DraftDataObject)

    // Объединяем данные с приоритетом на форму настроек
    const draftToUpdate = {
      ...(draft || {}),
      ...(formData || {}),
      ...form
    }

    // Убеждаемся что у нас есть все необходимые поля
    console.log('[handleSaveDraft] Saving draft with data:', draftToUpdate)

    const currentDraftObj = currentDraft()
    if (currentDraftObj?.created_by) {
      const draftWithRequiredFields = {
        ...draftToUpdate,
        created_at: currentDraftObj.created_at || Math.floor(Date.now() / 1000),
        created_by: currentDraftObj.created_by
      }
      setCurrentDraft(draftWithRequiredFields)
    } else {
      console.error('[handleSaveDraft] Missing created_by field in draft')
    }

    // Показываем уведомление об успешном сохранении
    showSnackbar({ body: t('Draft saved successfully') })
  }

  const removeSpecial = (ev: InputEvent) => {
    const input = ev.target as HTMLInputElement
    const value = input.value
    const newValue = value.startsWith('@') || value.startsWith('!') ? value.substring(1) : value
    input.value = newValue
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
                  value={form.cover ? t('Add another image') : t('Add image')}
                />
                <Show when={form.cover}>
                  <Button variant="secondary" onClick={handleDeleteCoverImage} value={t('Delete cover')} />
                </Show>
              </div>
              <div
                class={clsx(styles.shoutCardCoverContainer, {
                  [styles.hasImage]: form.cover
                })}
              >
                <Show when={form.cover}>
                  <div class={styles.shoutCardCover}>
                    <Image src={form.cover} alt={form.title || ''} width={800} />
                  </div>
                </Show>
                <div class={styles.text}>
                  <Show when={form.mainTopic}>
                    <div class={styles.mainTopic}>{form.mainTopic?.title || ''}</div>
                  </Show>
                  <div class={styles.shoutCardTitle}>{form.title}</div>
                  <div class={styles.shoutCardSubtitle}>{form.subtitle || ''}</div>
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

            <div class={styles.commonSettings}>
              <GrowingTextarea
                class={styles.settingInput}
                variant="bordered"
                fieldName={t('Header')}
                placeholder={t('Come up with a title for your story')}
                initialValue={form.title}
                // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                onChange={(value: any) => setForm('title', value)}
                allowEnterKey={false}
                maxLength={100}
              />
              <GrowingTextarea
                class={styles.settingInput}
                variant="bordered"
                fieldName={t('Subheader')}
                placeholder={t('Come up with a subtitle for your story')}
                initialValue={form.subtitle || ''}
                // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                onChange={(value: any) => setForm('subtitle', value)}
                allowEnterKey={false}
                maxLength={100}
              />
              <SimpleRichEditor
                commands={['bold', 'italic']}
                placeholder={t('Write a short introduction')}
                content={composeDescription() || ''}
                onChange={(data?: EditorData) => setForm('description', data?.content || '')}
              />
            </div>

            <h4>{t('Slug')}</h4>
            <div class="pretty-form__item">
              <label for="slug">
                <input type="text" name="slug" id="slug" value={form.slug} onInput={removeSpecial} />
                {t('Slug')}
              </label>
            </div>

            <h4>{t('Topics')}</h4>
            <p class="description">
              {t(
                'Add a few topics so that the reader knows what your content is about and can find it on pages of topics that interest them. Topics can be swapped, the first topic becomes the title'
              )}
            </p>
            <div class={styles.inputContainer}>
              <div class={clsx('pretty-form__item', styles.topicSelectContainer)}>
                <Show when={sortedTopics().length > 0}>
                  <TopicSelect
                    topics={sortedTopics()}
                    onChange={handleTopicSelectChange}
                    selectedTopics={form.topics || []}
                    onMainTopicChange={(mainTopic) => setForm('mainTopic', mainTopic)}
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
                <Button
                  variant="light"
                  value={t('Cancel changes')}
                  class={styles.cancel}
                  onClick={handleCancelClick}
                />
                <Button variant="secondary" onClick={handleSaveDraft} value={t('Save draft')} />
                <Button onClick={handlePublishSubmit} variant="primary" value={t('Publish')} />
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
    </form>
  )
}
