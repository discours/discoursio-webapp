import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { Show, createEffect, createSignal, lazy, onMount } from 'solid-js'
import { createStore } from 'solid-js/store'
import { SimpleRichEditor } from '~/components/SimpleRichEditor/SimpleRichEditor'
import { UploadModalContent } from '~/components/Upload/UploadModalContent/UploadModalContent'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import { Image } from '~/components/_shared/Image'
import { DraftInput, useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useTopics } from '~/context/topics'
import { useSnackbar, useUI } from '~/context/ui'
import { Topic } from '~/graphql/schema/core.gen'
import { UploadedFile } from '~/types/upload'
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

const emptyConfig: DraftInput = {
  cover: '',
  mainTopic: EMPTY_TOPIC,
  slug: '',
  title: '',
  subtitle: '',
  description: '',
  topics: [],
  body: '',
  layout: 'article',
  id: -1
}

export const PublishSettings = () => {
  const { t } = useLocalize()
  const { showModal, hideModal } = useUI()
  const navigate = useNavigate()
  const { session } = useSession()
  const { sortedTopics } = useTopics()
  const { showSnackbar } = useSnackbar()
  const [topics, setTopics] = createSignal<Topic[]>(sortedTopics())
  const [settingsForm, setSettingsForm] = createStore<DraftInput>(emptyConfig)
  const [formErrors, setFormErrors] = createStore({} as Record<keyof DraftInput, string>)
  const { currentDraft } = useDrafts()
  onMount(() => setSettingsForm(currentDraft() as DraftInput))

  const composeDescription = () => {
    if (!currentDraft()?.description) {
      const cleanFootnotes = currentDraft()?.body?.replaceAll(
        /<footnote data-value=".*?">(.*?)<\/footnote>/g,
        ''
      )
      const leadText = cleanFootnotes?.replaceAll(/<\/?[^>]+(>|$)/gi, ' ') || ''
      return shorten(leadText, DESCRIPTION_MAX_LENGTH).trim()
    }
    return currentDraft()?.description
  }

  createEffect(() => setTopics(sortedTopics()))

  const handleUploadModalContentCloseSetCover = (image: UploadedFile | undefined) => {
    hideModal()
    setSettingsForm('cover', image?.url)
  }
  const handleDeleteCoverImage = () => {
    setSettingsForm('cover', '')
  }

  const handleTopicSelectChange = (newSelectedTopics: Topic[]) => {
    if (
      currentDraft()?.topics?.length === 0 ||
      newSelectedTopics.every((topic: Topic) => topic.id !== currentDraft()?.topics?.[0]?.id)
    ) {
      setSettingsForm((prev) => {
        return {
          ...prev,
          mainTopic: newSelectedTopics[0]
        }
      })
    }

    if (newSelectedTopics.length > 0) {
      setFormErrors('topics', '')
    }
    setSettingsForm('topics', newSelectedTopics)
  }

  const handleBackClick = () => {
    navigate(`/edit/${currentDraft()?.id}`)
  }
  const handleCancelClick = () => {
    setSettingsForm(currentDraft() as DraftInput)
    handleBackClick()
  }

  const { drafts, updateDraft, publishDraft } = useDrafts()

  const handlePublishSubmit = () => {
    const draft = drafts().find((d) => d.id === currentDraft()?.id)
    console.group('[handlePublishSubmit]')
    const updatedDraft = { ...currentDraft(), ...settingsForm, ...draft }

    console.log('updating draft: ', updatedDraft)
    updateDraft(updatedDraft as DraftInput)

    console.log('Publishing data:', updatedDraft)

    // Проверяем наличие выбранных топиков
    const hasValidTopics = (updatedDraft.topics || []).length > 0 || updatedDraft.mainTopic?.id

    console.log('Topics validation:', {
      selectedTopics: updatedDraft.topics,
      mainTopic: updatedDraft.mainTopic,
      hasValidTopics
    })

    if (hasValidTopics) {
      console.log('Topics validation passed, proceeding with publication')
      publishDraft(currentDraft()?.id || -1)
    } else {
      console.warn('Publication rejected: no valid topics')
      showSnackbar({ body: t('Please, select at least one topic') })
    }
    console.groupEnd()
  }

  const handleSaveDraft = () => updateDraft(drafts().find((d) => d.id === currentDraft()?.id) as DraftInput)

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
                  value={settingsForm.cover ? t('Add another image') : t('Add image')}
                />
                <Show when={settingsForm.cover}>
                  <Button variant="secondary" onClick={handleDeleteCoverImage} value={t('Delete cover')} />
                </Show>
              </div>
              <div
                class={clsx(styles.shoutCardCoverContainer, {
                  [styles.hasImage]: settingsForm.cover
                })}
              >
                <Show when={settingsForm.cover}>
                  <div class={styles.shoutCardCover}>
                    <Image src={settingsForm.cover} alt={settingsForm.title || ''} width={800} />
                  </div>
                </Show>
                <div class={styles.text}>
                  <Show when={settingsForm.mainTopic}>
                    <div class={styles.mainTopic}>{settingsForm.mainTopic?.title || ''}</div>
                  </Show>
                  <div class={styles.shoutCardTitle}>{settingsForm.title}</div>
                  <div class={styles.shoutCardSubtitle}>{settingsForm.subtitle || ''}</div>
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
                initialValue={settingsForm.title}
                // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                value={(value: any) => setSettingsForm('title', value)}
                allowEnterKey={false}
                maxLength={100}
              />
              <GrowingTextarea
                class={styles.settingInput}
                variant="bordered"
                fieldName={t('Subheader')}
                placeholder={t('Come up with a subtitle for your story')}
                initialValue={settingsForm.subtitle || ''}
                // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                value={(value: any) => setSettingsForm('subtitle', value)}
                allowEnterKey={false}
                maxLength={100}
              />
              <SimpleRichEditor
                bubble={true}
                commands={['bold', 'italic']}
                placeholder={t('Write a short introduction')}
                content={composeDescription() || ''}
                onChange={(value?: string) => value && setSettingsForm('description', value)}
              />
            </div>

            <h4>{t('Slug')}</h4>
            <div class="pretty-form__item">
              <label for="slug">
                <input
                  type="text"
                  name="slug"
                  id="slug"
                  value={settingsForm.slug}
                  onInput={removeSpecial}
                />
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
                <Show when={topics().length > 0}>
                  <TopicSelect
                    topics={topics()}
                    onChange={handleTopicSelectChange}
                    selectedTopics={settingsForm.topics || []}
                    onMainTopicChange={(mainTopic) => setSettingsForm('mainTopic', mainTopic)}
                    mainTopic={settingsForm.mainTopic}
                  />
                </Show>
              </div>
              <Show when={formErrors.topics}>
                <div class={styles.validationError}>{formErrors.topics}</div>
              </Show>
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
