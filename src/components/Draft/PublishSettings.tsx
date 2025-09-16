import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { batch, createEffect, createMemo, createSignal, lazy, onCleanup, onMount, Show } from 'solid-js'
import toast from 'solid-toast'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import { Image } from '~/components/_shared/Image'
import { InviteMembers } from '~/components/_shared/InviteMembers/InviteMembers'
import { type EditorData } from '~/components/SimpleRichEditor/lib/types'
import { UploadModalContent } from '~/components/Upload/UploadModalContent/UploadModalContent'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useTopics } from '~/context/topics'
import { useUI } from '~/context/ui'
import { Author, DraftInput, Topic } from '~/graphql/generated/graphql'
import { slugify } from '~/intl/translit'
import { UploadedFile } from '~/types/upload'
import { Modal } from '../_shared/Modal'
import { TopicPillsCloud } from '../_shared/TopicPillsCloud'

import stylesBeside from '../Feed/Beside.module.scss'
import styles from './PublishSettings.module.scss'

const GrowingTextarea = lazy(() => import('~/components/_shared/GrowingTextarea/GrowingTextarea'))
const DESCRIPTION_MAX_LENGTH = 40

const shorten = (str: string, maxLen: number) => {
  if (str.length <= maxLen) return str
  const result = str.slice(0, Math.max(0, str.lastIndexOf(' ', maxLen))).trim()
  return `${result}...`
}

export const PublishSettings = () => {
  const { t } = useLocalize()
  const {
    currentDraft,
    updateDraftField,
    publishDraft,
    unpublishShout,
    validationErrors,
    validateCurrentDraft,
    clearValidationErrors,
    updateDraft,
    syncDraft,
    getEditorContent,
    isDraftPublished
  } = useDrafts()
  const { showModal } = useUI()
  const { loadTopics } = useTopics()
  const { session } = useSession()
  const navigate = useNavigate()
  const [coverImage, setCoverImage] = createSignal<UploadedFile | null>(null)
  const [isTopicsLoading, setIsTopicsLoading] = createSignal(true)
  const [isLoading, setIsLoading] = createSignal(false)
  const [coverUploadLoading, setCoverUploadLoading] = createSignal(false)

  // 🔧 СИНХРОНИЗАЦИЯ ДАННЫХ при загрузке компонента
  onMount(async () => {
    const draft = currentDraft()
    if (draft?.id) {
      console.log(`[PublishSettings] Синхронизируем черновик #${draft.id} с localStorage...`)
      try {
        await syncDraft(draft.id)
        console.log('[PublishSettings] Синхронизация завершена')

        // 🔧 АВТОМАТИЧЕСКАЯ ГЕНЕРАЦИЯ SLUG при загрузке
        const syncedDraft = await syncDraft(draft.id)
        const finalDraft = syncedDraft || draft

        // 🔧 Генерируем slug ТОЛЬКО если его совсем нет и есть заголовок
        if (
          finalDraft &&
          (!finalDraft.slug || finalDraft.slug.trim() === '') &&
          finalDraft.title &&
          finalDraft.title.trim() !== ''
        ) {
          console.log('🔧 [AUTO-SLUG] Генерируем slug при загрузке из заголовка:', finalDraft.title)
          const generatedSlug = slugify(finalDraft.title)

          if (generatedSlug) {
            // Обновляем slug в черновике
            updateDraftField(finalDraft.id, 'slug', generatedSlug, false)
            console.log('🔧 [AUTO-SLUG] Slug сгенерирован и сохранен:', generatedSlug)
          }
        } else if (finalDraft?.slug && finalDraft.slug.trim() !== '') {
          console.log('🔧 [AUTO-SLUG] Используем существующий слаг:', finalDraft.slug)
        } else {
          console.log('🔧 [AUTO-SLUG] Слаг не найден и не может быть сгенерирован (нет заголовка)')
        }
      } catch (error) {
        console.error('[PublishSettings] Ошибка синхронизации:', error)
      }
    }
  })

  // 🔧 ПОЛУЧАЕМ АКТУАЛЬНОЕ СОДЕРЖИМОЕ с приоритетом localStorage
  const getActualContent = createMemo(() => {
    const draft = currentDraft()
    if (!draft?.id) return { title: '', body: '', lead: '' }

    // Приоритет: localStorage > currentDraft
    const bodyFromStorage = getEditorContent(`draft-${draft.id}-body`)
    const titleFromStorage = getEditorContent(`draft-${draft.id}-title`)
    const leadFromStorage = getEditorContent(`draft-${draft.id}-lead`)

    return {
      title: titleFromStorage || draft.title || '',
      body: bodyFromStorage || draft.body || '',
      lead: leadFromStorage || draft.lead || ''
    }
  })

  const handleFieldChange = (key: keyof DraftInput, value: string | number | boolean | Topic | Author | Topic[]) => {
    const draft = currentDraft()
    if (!draft?.id) return

    batch(() => {
      let valueToSave: string | EditorData

      if (typeof value === 'object' && value !== null) {
        console.warn(`[PublishSettings] Unexpected object type in handleFieldChange for key ${key}:`, value)
        valueToSave = JSON.stringify(value)
      } else {
        valueToSave = String(value)
      }

      if (key === 'title') {
        const title = value as string
        const newSlug = slugify(title)
        updateDraftField(draft.id, 'slug', newSlug, false)
      }

      updateDraftField(draft.id, key, valueToSave, false)
    })

    console.log(`[PublishSettings] Updated field ${key} via context for draft ${draft.id}`)
  }

  // Исправляем гидрацию: createEffect НЕ должен быть внутри onMount!
  // Добавляем проверку для стабильной гидрации
  createEffect(() => {
    const draft = currentDraft()
    if (!draft) {
      // Если черновика нет, устанавливаем null стабильно
      setCoverImage(null)
      return
    }

    const coverUrl = draft.cover
    if (coverUrl && coverUrl.trim() !== '') {
      setCoverImage({ url: coverUrl } as UploadedFile)
    } else {
      setCoverImage(null)
    }
  })

  onMount(async () => {
    setIsTopicsLoading(true)
    try {
      console.log('[PublishSettings] Starting to load topics...')
      const topics = await loadTopics()
      console.log('[PublishSettings] Topics loaded:', topics?.length || 0, 'topics')
    } catch (error) {
      console.error('[PublishSettings] Error loading topics:', error)
    } finally {
      setIsTopicsLoading(false)
    }

    clearValidationErrors()

    onCleanup(() => {
      clearValidationErrors()
    })
  })

  const description = createMemo(() => {
    const draft = currentDraft()
    if (!draft) return ''

    const stripHtml = (html: string) => {
      return html
        .replace(/<tooltip[^>]*>.*?<\/tooltip>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    if (draft.lead) {
      const cleanLeadText = stripHtml(draft.lead)
      return shorten(cleanLeadText, DESCRIPTION_MAX_LENGTH)
    }
    if (draft.body) {
      const cleanBodyText = stripHtml(draft.body)
      return shorten(cleanBodyText, DESCRIPTION_MAX_LENGTH)
    }
    return ''
  })

  const handleUploadModalContentCloseSetCover = (image: UploadedFile | undefined) => {
    const draftId = currentDraft()?.id
    if (!draftId) return

    batch(() => {
      showModal('uploadCoverImage')
      setCoverUploadLoading(true)
      setCoverImage(image || null)
      updateDraftField(draftId, 'cover', image?.url || '', false)
      setCoverUploadLoading(false)
    })
  }

  const handleDeleteCoverImage = () => {
    const draftId = currentDraft()?.id
    if (!draftId) return

    batch(() => {
      setCoverImage(null)
      updateDraftField(draftId, 'cover', '', false)
    })
  }

  const handleBackClick = () => {
    const draft = currentDraft()
    if (!draft?.draft_id && draft?.local_id) {
      navigate(`/edit/${draft.local_id}/local`)
    } else if (draft?.id) {
      navigate(`/edit/${draft.id}`)
    } else {
      navigate('/edit')
    }
  }

  const handlePublishSubmit = async () => {
    // Сначала синхронизируем черновик чтобы получить актуальный контент
    const draft = currentDraft()
    if (!draft?.id) {
      console.error('[PublishSettings] No draft ID found for publishing')
      toast.error(t('No draft found for publishing'))
      return
    }

    // 🔍 ДИАГНОСТИКА: Логируем состояние черновика ДО синхронизации
    console.group(`🔍 [VALIDATION DEBUG] Диагностика черновика #${draft.id} перед публикацией`)
    console.log('📝 Исходное состояние черновика:', {
      id: draft.id,
      title: draft.title,
      titleLength: draft.title?.length || 0,
      titleTrimmed: draft.title?.trim(),
      slug: draft.slug,
      body: `${draft.body?.substring(0, 100)}...`,
      bodyLength: draft.body?.length || 0,
      bodyTrimmed: draft.body?.trim(),
      topics: draft.topics,
      topicsCount: draft.topics?.length || 0,
      topicsArray: Array.isArray(draft.topics),
      hasValidTopics: draft.topics && Array.isArray(draft.topics) && draft.topics.length > 0
    })

    // Синхронизируем черновик чтобы получить актуальный контент из localStorage
    console.log('🔄 Синхронизируем черновик с localStorage...')
    const syncedDraft = await syncDraft(draft.id)
    const finalDraft = syncedDraft || draft

    // 🔧 ПОЛУЧАЕМ АКТУАЛЬНОЕ СОДЕРЖИМОЕ с приоритетом localStorage
    const actualContent = getActualContent()

    console.log('📝 Состояние после синхронизации:', {
      id: finalDraft?.id,
      title: finalDraft?.title,
      titleLength: finalDraft?.title?.length || 0,
      titleTrimmed: finalDraft?.title?.trim(),
      slug: finalDraft?.slug,
      body: `${finalDraft?.body?.substring(0, 100)}...`,
      bodyLength: finalDraft?.body?.length || 0,
      bodyTrimmed: finalDraft?.body?.trim(),
      topics: finalDraft?.topics,
      topicsCount: finalDraft?.topics?.length || 0,
      topicsArray: Array.isArray(finalDraft?.topics),
      hasValidTopics: finalDraft?.topics && Array.isArray(finalDraft?.topics) && finalDraft?.topics.length > 0,
      // 🔧 ДОПОЛНИТЕЛЬНО: Показываем контент из localStorage
      titleFromStorage: actualContent.title,
      bodyFromStorage: actualContent.body?.substring(0, 50),
      bodyLengthFromStorage: actualContent.body?.length || 0
    })

    // Проверяем наличие тем перед публикацией
    const hasTopics = finalDraft.topics && Array.isArray(finalDraft.topics) && finalDraft.topics.length > 0
    console.log('✅ Проверка тем:', { hasTopics, topics: finalDraft.topics })
    if (!hasTopics) {
      console.warn('❌ ОШИБКА: Нет выбранных тем')
      console.groupEnd()
      toast.error(t('Please select at least one topic before publishing'))
      return
    }

    // Проверяем наличие заголовка
    const hasTitle = actualContent.title && actualContent.title.trim() !== ''
    console.log('✅ Проверка заголовка:', {
      hasTitle,
      titleFromStorage: actualContent.title,
      titleFromDraft: finalDraft.title,
      trimmed: actualContent.title?.trim()
    })
    if (!hasTitle) {
      console.warn('❌ ОШИБКА: Нет заголовка')
      console.groupEnd()
      toast.error(t('Please enter a title before publishing'))
      return
    }

    // Проверяем наличие содержимого
    const hasContent = actualContent.body && actualContent.body.trim() !== '' && actualContent.body !== '<br>'
    console.log('✅ Проверка контента:', {
      hasContent,
      bodyFromStorage: actualContent.body?.substring(0, 50),
      bodyFromDraft: finalDraft.body?.substring(0, 50),
      bodyTrimmed: actualContent.body?.trim(),
      bodyLength: actualContent.body?.length || 0
    })
    if (!hasContent) {
      console.warn('❌ ОШИБКА: Нет контента')
      console.groupEnd()
      toast.error(t('Please add content before publishing'))
      return
    }

    // Проверяем, не опубликован ли уже этот черновик
    if (isDraftPublished(finalDraft.id)) {
      console.warn('❌ ОШИБКА: Черновик уже опубликован')
      console.log('📝 Состояние черновика:', {
        id: finalDraft.id,
        published_at: finalDraft.published_at,
        shout_published_at: finalDraft.shout?.published_at,
        slug: finalDraft.slug
      })
      console.groupEnd()
      toast.error(t('This article is already published. You can edit the published version.'))
      // Перенаправляем на опубликованную статью
      if (finalDraft.slug) {
        navigate(`/${finalDraft.slug}`)
      }
      return
    }

    // 🔧  Автоматически генерируем slug если его нет
    if (!finalDraft.slug || finalDraft.slug.trim() === '') {
      console.log('🔧 [AUTO-FIX] Генерируем slug из заголовка:', finalDraft.title)
      const generatedSlug = slugify(finalDraft.title || '')
      console.log('🔧 [AUTO-FIX] Сгенерированный slug:', generatedSlug)

      if (generatedSlug) {
        // Обновляем slug в черновике
        finalDraft.slug = generatedSlug

        // 🔧 КРИТИЧЕСКИ ВАЖНО: Сохраняем slug на сервере перед публикацией
        console.log('🔧 [AUTO-FIX] Сохраняем slug на сервере перед публикацией...')
        try {
          const draftInput: DraftInput = {
            id: finalDraft.id,
            slug: generatedSlug,
            // Включаем другие обязательные поля для сохранения
            title: finalDraft.title || '',
            body: finalDraft.body || '',
            topic_ids: Array.isArray(finalDraft.topics)
              ? finalDraft.topics.filter((topic): topic is Topic => Boolean(topic?.id)).map((topic) => topic.id)
              : []
          }

          const updateResult = await updateDraft(draftInput)
          console.log('🔧 [AUTO-FIX] Результат сохранения slug на сервере:', updateResult)

          if (updateResult?.error || updateResult?.data?.update_draft?.error) {
            console.error(
              '🔧 [AUTO-FIX] ❌ Ошибка сохранения slug на сервере:',
              updateResult?.error || updateResult?.data?.update_draft?.error
            )
            console.groupEnd()
            toast.error(t('Failed to save URL on server. Please try again.'))
            return
          }

          console.log('🔧 [AUTO-FIX] ✅ Slug успешно сохранен на сервере:', generatedSlug)
        } catch (error) {
          console.error('🔧 [AUTO-FIX] ❌ Критическая ошибка при сохранении slug:', error)
          console.groupEnd()
          toast.error(t('Failed to save URL. Please try again.'))
          return
        }

        // Также сохраняем в локальном контексте
        updateDraftField(finalDraft.id, 'slug', generatedSlug, false)
        console.log('🔧 [AUTO-FIX] ✅ Slug установлен локально и на сервере:', generatedSlug)
      } else {
        console.warn('🔧 [AUTO-FIX] ❌ Не удалось сгенерировать slug из заголовка')
        console.groupEnd()
        toast.error(t('Cannot generate URL from title. Please enter a valid title.'))
        return
      }
    } else {
      console.log('🔧 [AUTO-FIX] Используем существующий слаг:', finalDraft.slug)
    }

    console.log('✅ Все проверки пройдены, переходим к публикации')
    console.log('🔧 [FINAL CHECK] Финальное состояние перед публикацией:', {
      id: finalDraft.id,
      title: finalDraft.title,
      slug: finalDraft.slug,
      published_at: finalDraft.published_at,
      shout_id: finalDraft.shout?.id,
      shout_published_at: finalDraft.shout?.published_at,
      isPublished: isDraftPublished(finalDraft.id)
    })
    console.groupEnd()

    console.log('[PublishSettings] Starting publication process for draft:', {
      id: finalDraft.id,
      title: finalDraft.title,
      topics: finalDraft.topics,
      topicIds: finalDraft.topics?.map((t) => t?.id),
      body: `${finalDraft.body?.substring(0, 100)}...`,
      slug: finalDraft.slug
    })

    setIsLoading(true)
    clearValidationErrors()

    try {
      console.log('[PublishSettings] Validating draft...')
      const validationResult = await validateCurrentDraft()
      console.log('[PublishSettings] Validation result:', validationResult)

      if (!validationResult) {
        console.warn('[PublishSettings] Draft validation failed')
        toast.error(t('Please fix validation errors before publishing'))
        return
      }

      console.log('[PublishSettings] Calling publishDraft...')
      const result = await publishDraft(finalDraft.id)
      console.log('[PublishSettings] publishDraft result:', result)

      const publishedDraft = result?.data?.publish_draft?.draft

      if (publishedDraft) {
        console.log('[PublishSettings] Publication successful, navigating to:', publishedDraft.slug)
        batch(() => {
          toast.success(t('Article published successfully'))
          // Используем slug опубликованной статьи для корректного URL
          navigate(`/${publishedDraft.slug}`)
        })
      } else if (result?.error) {
        console.error('[PublishSettings] GraphQL error:', result.error)
        toast.error(t(result.error.message || 'Error publishing article'))
      } else if (result?.data?.publish_draft?.error) {
        console.error('[PublishSettings] Server error:', result.data.publish_draft.error)

        // Специальная обработка ошибки дублирующегося slug
        const errorMessage = result.data.publish_draft.error
        if (errorMessage.includes('duplicate key value') && errorMessage.includes('slug')) {
          console.warn('[PublishSettings] Duplicate slug detected - article may already be published')
          toast.error(t('This article is already published or URL is taken. Please use a different title or URL.'))
        } else {
          toast.error(t(errorMessage || 'Error publishing article'))
        }
      } else {
        console.error('[PublishSettings] Unknown error in result:', result)
        toast.error(t('Error publishing article'))
      }
    } catch (error) {
      console.error('[PublishSettings] Error publishing article:', error)
      toast.error(error instanceof Error ? error.message : t('Unknown error occurred'))
    } finally {
      setIsLoading(false)
    }
  }

  const isPublished = createMemo(() => {
    const draft = currentDraft()
    return !!draft?.published_at
  })

  const handleUnpublish = async () => {
    const draft = currentDraft()
    if (!draft?.id) return

    // 🔧  Используем ID шаута, а не ID черновика
    const shoutId = draft.shout?.id
    if (!shoutId) {
      console.error('[PublishSettings] Не найден ID шаута для снятия с публикации')
      toast.error(t('Error: Shout ID not found'))
      return
    }

    setIsLoading(true)

    try {
      const result = await unpublishShout(shoutId)
      const unpublishedShoutId = result?.data?.unpublish_shout?.shout?.id

      if (unpublishedShoutId) {
        batch(() => {
          toast.success(t('Article unpublished successfully'))
          navigate(`/edit/${draft.id}`)
        })
      } else if (result?.error) {
        toast.error(t(result.error.message || 'Error unpublishing article'))
      } else {
        toast.error(t('Error unpublishing article'))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Unknown error occurred'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveDraft = async () => {
    const draft = currentDraft()
    if (!draft?.id) return

    setIsLoading(true)

    try {
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
        seo: draft.seo || '',
        topic_ids: Array.isArray(draft.topics)
          ? draft.topics.filter((topic): topic is Topic => Boolean(topic?.id)).map((topic) => topic.id)
          : [],
        main_topic_id:
          Array.isArray(draft.topics) && draft.topics.length > 0 && draft.topics[0] ? draft.topics[0].id : undefined,
        author_ids: draft.authors?.map((a) => a?.id).filter((id): id is number => !!id) || []
      }

      const result = await updateDraft(draftInput)

      if (result?.data?.update_draft?.draft) {
        toast.success(t('Draft saved successfully'))
      } else if (result?.error) {
        toast.error(t(result.error.message || 'Error saving draft'))
      } else {
        toast.error(t('Error saving draft'))
      }
    } catch (error) {
      console.error('[PublishSettings] Error saving draft:', error)
      toast.error(error instanceof Error ? error.message : t('Unknown error occurred'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = async () => {
    const draft = currentDraft()
    if (!draft?.id) return

    setIsLoading(true)

    try {
      // Перезагружаем черновик с сервера, игнорируя локальные изменения
      await syncDraft(draft.id)

      // Очищаем локальное хранилище для этого черновика
      const draftStorageKeys = [
        `draft-${draft.id}-title`,
        `draft-${draft.id}-subtitle`,
        `draft-${draft.id}-lead`,
        `draft-${draft.id}-body`,
        `draft-${draft.id}-slug`,
        `draft-${draft.id}-cover`,
        `draft-${draft.id}-cover_caption`,
        `draft-${draft.id}-seo`,
        `draft-${draft.id}-topic_ids`,
        `draft-${draft.id}-main_topic_id`
      ]

      draftStorageKeys.forEach((key) => {
        try {
          localStorage.removeItem(key)
        } catch (error) {
          console.warn(`[PublishSettings] Could not remove storage key ${key}:`, error)
        }
      })

      toast.success(t('Changes reset successfully'))

      // Перенаправляем на страницу редактирования для обновления UI
      navigate(`/edit/${draft.id}`)
    } catch (error) {
      console.error('[PublishSettings] Error resetting changes:', error)
      toast.error(error instanceof Error ? error.message : t('Unknown error occurred'))
    } finally {
      setIsLoading(false)
    }
  }

  const [editingTitle, setEditingTitle] = createSignal(false)
  const [editingSubtitle, setEditingSubtitle] = createSignal(false)
  const [editingTeaser, setEditingTeaser] = createSignal(false)

  const draft = currentDraft

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
            <h4>{t('Slug')}</h4>
            <div class={styles.errorMessage}>{t(validationErrors().slug || '')}</div>
            <div class="pretty-form__item">
              <input
                type="text"
                name="slug"
                id="slug"
                value={draft()?.slug || ''}
                onInput={(e) => {
                  const input = e.target as HTMLInputElement
                  handleFieldChange('slug', input.value)
                }}
              />
            </div>

            <h4>{t('Topics')}</h4>
            <div class={styles.errorMessage}>
              {t(validationErrors().topic_ids || validationErrors().main_topic_id || '')}
            </div>
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
                  <TopicPillsCloud draftId={currentDraft()?.id || -1} />
                </Show>
              </div>
            </div>

            <h4>{t('Collaborators')}</h4>
            <Button variant="primary" onClick={() => showModal('inviteMembers')} value={t('Invite collaborators')} />

            <h4>{t('Material card')}</h4>
            <p class="description">
              {t(
                'Choose a title image for the article. You can immediately see how the publication card will look like.'
              )}
            </p>
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
                <Show when={coverImage()?.url}>
                  <div class={styles.shoutCardCover}>
                    <Image src={coverImage()?.url || ''} alt={draft()?.title || ''} width={800} />
                  </div>
                </Show>
                <div class={styles.text}>
                  <Show when={draft()?.topics?.length}>
                    <div class={styles.mainTopic}>{draft()?.topics?.[0]?.title || ''}</div>
                  </Show>
                  <Show when={!getActualContent().title?.trim()}>
                    <div class={styles.errorMessage}>{t('⚠️ Please enter a title before publishing')}</div>
                  </Show>
                  <Show
                    when={editingTitle()}
                    fallback={
                      <div onClick={() => setEditingTitle(true)} class={styles.shoutCardTitle}>
                        {draft()?.title || t('Click to add title')}
                      </div>
                    }
                  >
                    <GrowingTextarea
                      allowEnterKey={true}
                      class={styles.lyrics || ''}
                      placeholder={t('Title')}
                      onChange={(value: string) => handleFieldChange('title', value)}
                      initialValue={draft()?.title || ''}
                    />
                  </Show>
                  <Show
                    when={editingSubtitle()}
                    fallback={
                      <div onClick={() => setEditingSubtitle(true)} class={styles.shoutCardSubtitle}>
                        {draft()?.subtitle || ''}
                      </div>
                    }
                  >
                    <GrowingTextarea
                      allowEnterKey={true}
                      class={styles.lyrics || ''}
                      placeholder={t('Subtitle')}
                      onChange={(value: string) => handleFieldChange('subtitle', value)}
                      initialValue={draft()?.subtitle || ''}
                    />
                  </Show>

                  <Show when={!draft()?.body?.trim() || draft()?.body === '<br>'}>
                    <div class={styles.errorMessage}>{t('Please add content before publishing')}</div>
                  </Show>

                  <Show
                    when={editingTeaser()}
                    fallback={
                      <div onClick={() => setEditingTeaser(true)} class={styles.shoutCardTeaser}>
                        {draft()?.seo || description()}
                      </div>
                    }
                  >
                    <GrowingTextarea
                      allowEnterKey={true}
                      class={styles.lyrics}
                      placeholder={t('Teaser')}
                      onChange={(value: string) => handleFieldChange('seo', value)}
                      initialValue={draft()?.seo || ''}
                    />
                  </Show>
                  <div class={styles.shoutAuthor}>{session()?.author?.name || t('Anonymous')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class={styles.formActions}>
        <div class="wide-container">
          <div class="row">
            <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
              <div class={styles.content}>
                <div class={styles.draftActions}>
                  <Button
                    variant="secondary"
                    onClick={handleCancel}
                    value={isLoading() ? t('Cancelling...') : t('Cancel')}
                    disabled={isLoading()}
                  />
                  <Button
                    variant="primary"
                    onClick={handleSaveDraft}
                    value={isLoading() ? t('Saving...') : t('Save draft')}
                    disabled={isLoading()}
                  />
                </div>

                <Show
                  when={!isPublished()}
                  fallback={
                    <Button
                      variant="primary"
                      onClick={handleUnpublish}
                      value={isLoading() ? t!('Unpublishing...') : t!('Unpublish')}
                      disabled={isLoading() /* || savingDraft() */}
                    />
                  }
                >
                  <Button
                    onClick={handlePublishSubmit}
                    variant="primary"
                    value={isLoading() ? t!('Publishing...') : t!('Publish')}
                    disabled={isLoading()}
                  />
                </Show>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Modal variant="narrow" name="uploadCoverImage">
        <UploadModalContent
          onClose={(value: UploadedFile | undefined) => handleUploadModalContentCloseSetCover(value as UploadedFile)}
        />
      </Modal>
      <Modal variant="medium" name="inviteMembers">
        <InviteMembers variant={'coauthors'} title={t('Invite collaborators')} />
      </Modal>
    </form>
  )
}
