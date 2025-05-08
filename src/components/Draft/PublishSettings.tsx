import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { Show, batch, createEffect, createMemo, createSignal, lazy, onCleanup, onMount } from 'solid-js'
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
import { Author, DraftInput, Topic } from '~/graphql/schema/core.gen'
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
    clearValidationErrors
  } = useDrafts()
  const { showModal } = useUI()
  const { loadTopics } = useTopics()
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

  const description = createMemo(() => {
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
    if (draft?.isLocalOnly && draft?.localId) {
      navigate(`/edit/${draft.localId}/local`)
    } else if (draft?.id) {
      navigate(`/edit/${draft.id}`)
    } else {
      navigate('/edit')
    }
  }

  const handlePublishSubmit = async () => {
    const draft = currentDraft()
    if (!draft?.id) return

    setIsLoading(true)
    clearValidationErrors()

    try {
      const validationResult = await validateCurrentDraft()
      if (!validationResult) {
        console.warn('[PublishSettings] Draft validation failed')
        return
      }

      const result = await publishDraft(draft.id)
      const publishedDraftId = result?.data?.publish_draft?.draft?.id

      if (publishedDraftId) {
        batch(() => {
          toast.success(t('Article published successfully'))
          navigate(`/shout/${publishedDraftId}`)
        })
      } else if (result?.error) {
        toast.error(t(result.error.message || 'Error publishing article'))
      } else {
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

    setIsLoading(true)

    try {
      const result = await unpublishShout(draft.id)
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
            <p class="description">
              {t(
                'Choose a title image for the article. You can immediately see how the publication card will look like.'
              )}
            </p>

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
            <Button
              variant="primary"
              onClick={() => showModal('inviteMembers')}
              value={t('Invite collaborators')}
            />

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
