import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { Show, createEffect, createSignal, lazy, onCleanup, onMount } from 'solid-js'
import toast from 'solid-toast'

import { type EditorData } from '~/components/SimpleRichEditor/lib/types'
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
import { Author, DraftInput, Maybe, Topic } from '~/graphql/schema/core.gen'
import { slugify } from '~/intl/translit'
import { UploadedFile } from '~/types/upload'
import { Modal } from '../_shared/Modal'
import { TopicSelect } from '../_shared/TopicSelect'

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

export const PublishSettings = () => {
  const { t } = useLocalize()
  const {
    currentDraft,
    publishDraft,
    unpublishShout,
    updateDraftField,
    validationErrors,
    validateCurrentDraft,
    clearValidationErrors
  } = useDrafts()
  const { showModal } = useUI()
  const { loadTopics, sortedTopics } = useTopics()
  const { session } = useSession()
  const navigate = useNavigate()
  const [coverImage, setCoverImage] = createSignal<UploadedFile | null>(null)
  const [isTopicsLoading, setIsTopicsLoading] = createSignal(true)
  const [isLoading, setIsLoading] = createSignal(false)
  const [coverUploadLoading, setCoverUploadLoading] = createSignal(false)

  const handleFieldChange = (
    key: keyof DraftInput,
    value: string | number | boolean | Topic | Author | Topic[]
  ) => {
    const draft = currentDraft()
    if (!draft?.id) return

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

    console.log(`[PublishSettings] Updated field ${key} via context for draft ${draft.id}`)
  }

  onMount(async () => {
    createEffect(() => {
      const coverUrl = currentDraft()?.cover
      if (coverUrl) {
        setCoverImage({ url: coverUrl } as UploadedFile)
      } else {
        setCoverImage(null)
      }
    })

    setIsTopicsLoading(true)
    try {
      await loadTopics()
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

  const description = () => {
    const draft = currentDraft()
    if (!draft) return ''

    const stripHtml = (html: string) => {
      return html
        .replace(/<footnote[^>]*>.*?<\/footnote>/g, '')
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
  }

  const handleUploadModalContentCloseSetCover = (image: UploadedFile | undefined) => {
    const draftId = currentDraft()?.id
    if (!draftId) return

    showModal('uploadCoverImage')
    setCoverUploadLoading(true)
    setCoverImage(image || null)
    updateDraftField(draftId, 'cover' as keyof DraftInput, image?.url || '', false)
    setCoverUploadLoading(false)
  }

  const handleDeleteCoverImage = () => {
    const draftId = currentDraft()?.id
    if (!draftId) return
    setCoverImage(null)
    updateDraftField(draftId, 'cover' as keyof DraftInput, '', false)
  }

  const handleTopicSelectChange = (newSelectedTopics: Topic[]) => {
    const draft = currentDraft()
    if (!draft?.id) return

    const topicIds = newSelectedTopics.map((t) => t.id).filter((id) => id > 0)

    updateDraftField(draft.id, 'topic_ids', JSON.stringify(topicIds), false)

    const currentMainTopicId = draft.mainTopic?.id
    if (
      newSelectedTopics.length > 0 &&
      (!currentMainTopicId || currentMainTopicId <= 0 || currentMainTopicId === topicIds[0])
    ) {
      const newMainTopicId = topicIds[0]
      updateDraftField(draft.id, 'main_topic_id' as keyof DraftInput, String(newMainTopicId), false)
    } else if (newSelectedTopics.length === 0) {
      updateDraftField(draft.id, 'main_topic_id' as keyof DraftInput, '', false)
    }

    console.log(`[PublishSettings] Updated topics for draft ${draft.id}`)
  }

  const handleMainTopicChange = (mainTopic: Topic) => {
    const draft = currentDraft()
    if (!draft?.id) return
    updateDraftField(draft.id, 'main_topic_id' as keyof DraftInput, String(mainTopic.id), false)
    console.log(`[PublishSettings] Updated main topic for draft ${draft.id}`)
  }

  const handleBackClick = () => {
    navigate(`/edit/${currentDraft()?.id}`)
  }

  const handlePublishSubmit = async () => {
    setIsLoading(true)
    clearValidationErrors()
    const draft = currentDraft()
    if (!draft?.id) {
      toast.error(t('Draft not found'))
      setIsLoading(false)
      return
    }

    try {
      const isValid = await validateCurrentDraft()

      if (!isValid) {
        toast.error(t('Please fix the errors before publishing.'))
        setIsLoading(false)
        return
      }

      const result = await publishDraft(draft.id)

      if (result?.data?.publish_draft?.draft) {
        toast.success(t('Draft published successfully'))
        clearValidationErrors()
        navigate(`/${result.data.publish_draft.draft.slug}`)
      } else if (result?.error) {
        toast.error(result.error.message)
      } else {
        toast.error(t('Unknown error during publishing'))
      }
    } catch (error) {
      console.error('[PublishSettings] Error publishing draft:', error)
      toast.error(error instanceof Error ? error.message : t('Unknown error occurred'))
    } finally {
      setIsLoading(false)
    }
  }

  const isPublished = () => {
    const draft = currentDraft()
    return draft?.published_at != null && draft?.published_at > 0
  }

  const handleUnpublish = async () => {
    setIsLoading(true)
    const draft = currentDraft()
    if (!draft?.id) {
      setIsLoading(false)
      return
    }

    try {
      const result = await unpublishShout(draft.id)
      if (result?.data?.unpublish_shout) {
        toast.success(t('Article unpublished successfully'))
      } else if (result?.error) {
        toast.error(result.error.message)
      }
    } catch (error) {
      console.error('[PublishSettings] Error unpublishing article:', error)
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
                    <Image src={coverImage()?.url || ''} alt={draft()?.title || ''} width={800} />
                  </div>
                </Show>
                <div class={styles.text}>
                  <Show when={draft()?.mainTopic}>
                    <div class={styles.mainTopic}>{draft()?.mainTopic?.title || ''}</div>
                  </Show>
                  <Show
                    when={editingTitle()}
                    fallback={
                      <div onClick={() => setEditingTitle(true)} class={styles.shoutCardTitle}>
                        {draft()?.title}
                      </div>
                    }
                  >
                    <GrowingTextarea
                      allowEnterKey={true}
                      class={styles.lyrics}
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
                      class={styles.lyrics}
                      placeholder={t('Subtitle')}
                      onChange={(value: string) => handleFieldChange('subtitle', value)}
                      initialValue={draft()?.subtitle || ''}
                    />
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
                value={draft()?.slug || ''}
                onInput={(e) => {
                  const input = e.target as HTMLInputElement
                  handleFieldChange('slug', input.value)
                }}
              />
              <Show when={validationErrors().slug}>
                <div class="error-message">{validationErrors().slug}</div>
              </Show>
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
                    selectedTopics={draft()?.topics?.filter((t: Maybe<Topic>) => t !== null) || []}
                    onMainTopicChange={handleMainTopicChange}
                    mainTopic={draft()?.mainTopic || EMPTY_TOPIC}
                  />
                  <Show when={validationErrors().topic_ids || validationErrors().main_topic_id}>
                    <div class="error-message">
                      {validationErrors().topic_ids || validationErrors().main_topic_id}
                    </div>
                  </Show>
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
