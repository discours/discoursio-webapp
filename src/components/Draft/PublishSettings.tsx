import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { Show, createEffect, createSignal, lazy, onMount } from 'solid-js'
import { createStore } from 'solid-js/store'
import { UploadModalContent } from '~/components/Upload/UploadModalContent/UploadModalContent'
import { Button } from '~/components/_shared/Button'
import { Icon } from '~/components/_shared/Icon'
import { Image } from '~/components/_shared/Image'
import { ShoutForm, useEditorContext } from '~/context/editor'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useTopics } from '~/context/topics'
import { useSnackbar, useUI } from '~/context/ui'
import { Topic } from '~/graphql/schema/core.gen'
import { UploadedFile } from '~/types/upload'
import { Modal } from '../_shared/Modal'
import { TopicSelect } from '../_shared/TopicSelect'

import stylesBeside from '../Feed/Beside.module.scss' // TODO: should not be here, implement more components
import styles from './PublishSettings.module.scss'

const MicroEditor = lazy(() => import('../Editor/MicroEditor'))
const GrowingTextarea = lazy(() => import('~/components/_shared/GrowingTextarea/GrowingTextarea'))
const DESCRIPTION_MAX_LENGTH = 400

type Props = {
  shoutId: number
  form: ShoutForm
}

const shorten = (str: string, maxLen: number) => {
  if (str.length <= maxLen) return str
  const result = str.slice(0, Math.max(0, str.lastIndexOf(' ', maxLen))).trim()
  return `${result}...`
}

const EMPTY_TOPIC: Topic = {
  id: -1,
  slug: ''
}

interface FormConfig {
  coverImageUrl?: string
  mainTopic?: Topic
  slug?: string
  title?: string
  subtitle?: string
  description?: string
  selectedTopics?: Topic[]
}

const emptyConfig: FormConfig = {
  coverImageUrl: '',
  mainTopic: EMPTY_TOPIC,
  slug: '',
  title: '',
  subtitle: '',
  description: '',
  selectedTopics: []
}

export const PublishSettings = (props: Props) => {
  const { t } = useLocalize()
  const { showModal, hideModal } = useUI()
  const navigate = useNavigate()
  const { session } = useSession()
  const { sortedTopics } = useTopics()
  const { showSnackbar } = useSnackbar()
  const [topics, setTopics] = createSignal<Topic[]>(sortedTopics())

  const composeDescription = () => {
    if (!props.form.description) {
      const cleanFootnotes = props.form.body.replaceAll(/<footnote data-value=".*?">(.*?)<\/footnote>/g, '')
      const leadText = cleanFootnotes.replaceAll(/<\/?[^>]+(>|$)/gi, ' ')
      return shorten(leadText, DESCRIPTION_MAX_LENGTH).trim()
    }
    return props.form.description
  }

  const initialData = () => {
    return {
      coverImageUrl: props.form?.coverImageUrl,
      mainTopic: props.form?.mainTopic || EMPTY_TOPIC,
      slug: props.form?.slug || '',
      title: props.form?.title || '',
      subtitle: props.form?.subtitle || '',
      description: composeDescription() || '',
      selectedTopics: []
    }
  }

  const [settingsForm, setSettingsForm] = createStore<FormConfig>(emptyConfig)

  onMount(() => {
    setSettingsForm(initialData())
  })

  createEffect(() => setTopics(sortedTopics()))

  const { formErrors, setForm, setFormErrors, saveShout, publishShout } = useEditorContext()

  const handleUploadModalContentCloseSetCover = (image: UploadedFile | undefined) => {
    hideModal()
    setSettingsForm('coverImageUrl', image?.url)
  }
  const handleDeleteCoverImage = () => {
    setSettingsForm('coverImageUrl', '')
  }

  const handleTopicSelectChange = (newSelectedTopics: Topic[]) => {
    if (
      props.form.selectedTopics.length === 0 ||
      newSelectedTopics.every((topic: Topic) => topic.id !== props.form.mainTopic?.id)
    ) {
      setSettingsForm((prev) => {
        return {
          ...prev,
          mainTopic: newSelectedTopics[0]
        }
      })
    }

    if (newSelectedTopics.length > 0) {
      setFormErrors('selectedTopics', '')
    }
    setForm('selectedTopics', newSelectedTopics)
  }

  const handleBackClick = () => {
    navigate(`/edit/${props.shoutId}`)
  }
  const handleCancelClick = () => {
    setSettingsForm(initialData())
    handleBackClick()
  }

  const { editing } = useEditorContext()

  const handlePublishSubmit = () => {
    console.group('[handlePublishSubmit]')
    const shoutData = { ...props.form, ...settingsForm, body: editing()?.getHTML() || '' }
    console.log('Publishing data:', shoutData)

    // Проверяем наличие выбранных топиков
    const hasValidTopics = shoutData.selectedTopics?.length > 0 || shoutData.mainTopic?.id

    console.log('Topics validation:', {
      selectedTopics: shoutData.selectedTopics,
      mainTopic: shoutData.mainTopic,
      hasValidTopics
    })

    if (hasValidTopics) {
      console.log('Topics validation passed, proceeding with publication')
      publishShout(shoutData)
    } else {
      console.warn('Publication rejected: no valid topics')
      showSnackbar({ body: t('Please, select at least one topic') })
    }
    console.groupEnd()
  }

  const handleSaveDraft = () => {
    console.group('[handleSaveDraft]')
    const shoutData = { ...props.form, ...settingsForm, body: editing()?.getHTML() || '' }
    console.log('Saving draft data:', shoutData)
    saveShout(shoutData)
    console.groupEnd()
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
                  value={settingsForm.coverImageUrl ? t('Add another image') : t('Add image')}
                />
                <Show when={settingsForm.coverImageUrl}>
                  <Button variant="secondary" onClick={handleDeleteCoverImage} value={t('Delete cover')} />
                </Show>
              </div>
              <div
                class={clsx(styles.shoutCardCoverContainer, {
                  [styles.hasImage]: settingsForm.coverImageUrl
                })}
              >
                <Show when={settingsForm.coverImageUrl ?? initialData().coverImageUrl}>
                  <div class={styles.shoutCardCover}>
                    <Image src={settingsForm.coverImageUrl} alt={initialData().title} width={800} />
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
              <MicroEditor
                placeholder={t('Write a short introduction')}
                content={composeDescription()}
                onChange={(value?: string) => value && setForm('description', value)}
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
                    selectedTopics={props.form.selectedTopics}
                    onMainTopicChange={(mainTopic) => setForm('mainTopic', mainTopic)}
                    mainTopic={props.form.mainTopic}
                  />
                </Show>
              </div>
              <Show when={formErrors.selectedTopics}>
                <div class={styles.validationError}>{formErrors.selectedTopics}</div>
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
