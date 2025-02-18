import { clsx } from 'clsx'
import { Show, createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
import { DropArea } from '~/components/_shared/DropArea'
import { Icon } from '~/components/_shared/Icon'
import { InviteMembers } from '~/components/_shared/InviteMembers'
import { Loading } from '~/components/_shared/Loading'
import { Popover } from '~/components/_shared/Popover'
import { EditorSwiper } from '~/components/_shared/SolidSwiper'
import { useLocalize } from '~/context/localize'
import type { Draft, MediaItem, Topic } from '~/graphql/schema/core.gen'
import { slugify } from '~/intl/translit'
import { getFileUrl } from '~/lib/getThumbUrl'
import { isDesktop } from '~/lib/mediaQuery'
import { LayoutType } from '~/types/common'
import { AutoSave } from '../AutoSave'
import { Panel } from '../Sidebar/Sidebar'
import { EditorData, SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'
import { AudioUploader } from '../Upload/AudioUploader'
import { VideoUploader } from '../Upload/VideoUploader'
import GrowingTextarea from '../_shared/GrowingTextarea/GrowingTextarea'
import { Modal } from '../_shared/Modal'
import { TableOfContents } from '../_shared/TableOfContents'

import { DraftInput, useDrafts } from '~/context/drafts'
import styles from '~/styles/views/EditView.module.scss'

export const MAX_HEADER_LIMIT = 100
export const EMPTY_TOPIC: Topic = {
  id: -1,
  slug: ''
}

const handleScrollTopButtonClick = (ev: MouseEvent | TouchEvent) => {
  ev.preventDefault()
  window?.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

/**
 * EditView component
 *
 * @returns EditView component
 */
export const EditView = () => {
  const { t } = useLocalize()
  const { updateDraft, currentDraft } = useDrafts()
  const [inputDataErrors, setFormErrors] = createSignal({} as Record<keyof DraftInput, string>)
  const [subtitleInput, setSubtitleInput] = createSignal<HTMLTextAreaElement | undefined>()

  // Handling when draft data is changed
  const [isSubtitleVisible, setIsSubtitleVisible] = createSignal(false)
  const [isLeadVisible, setIsLeadVisible] = createSignal(false)
  const [mediaItems, setMediaItems] = createSignal<MediaItem[]>([])
  createEffect(
    on(currentDraft, (d?: Draft) => {
      if (!d) return
      setIsSubtitleVisible(Boolean(d?.subtitle))
      setIsLeadVisible(Boolean(d?.lead))
      setMediaItems((d?.media || []) as MediaItem[])
    })
  )

  // Handle scroll
  const [isScrolled, setIsScrolled] = createSignal(false)
  const handleScroll = () => setIsScrolled(window.scrollY > 0)
  onMount(() => window.addEventListener('scroll', handleScroll, { passive: true }))
  onCleanup(() => window.removeEventListener('scroll', handleScroll))

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

  const handleInputChange = (key: keyof DraftInput, value: string) => {
    // console.log(`[handleInputChange] ${String(key)}: ${value}`)
    if (key === 'title') {
      handleInputChange('slug', slugify(value))
    }
    const draft = currentDraft()
    if (draft) {
      updateDraft({ ...draft, [key]: value } as DraftInput)
    }
  }

  const showSubtitleInput = () => {
    setIsSubtitleVisible(true)
    subtitleInput()?.focus()
  }

  const showLeadInput = () => {
    setIsLeadVisible(true)
  }

  const hideLeadInput = () => {
    setIsLeadVisible(false)
  }

  const HeadingActions = () => {
    return (
      <div class="col-md-19 col-lg-18 col-xl-16 offset-md-5">
        <Show when={currentDraft()}>
          <AutoSave
            cacheId={() => `draft:${currentDraft()?.id}`}
            data={() => JSON.stringify(currentDraft())}
          />
          <div class={styles.headingActions}>
            <Show when={!isSubtitleVisible() && currentDraft()?.layout !== 'audio'}>
              <div class={styles.action} onClick={showSubtitleInput}>
                {t('Add subtitle')}
              </div>
            </Show>
            <Show when={!isLeadVisible() && currentDraft()?.layout !== 'audio'}>
              <div class={styles.action} onClick={showLeadInput}>
                {t('Add intro')}
              </div>
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
                    <SimpleRichEditor
                      bubble={true}
                      hideButtons={true}
                      commands={['bold', 'italic', 'link']}
                      placeholder={t('A short introduction to keep the reader interested')}
                      content={currentDraft()?.lead || ''}
                      onBlur={() => hideLeadInput()}
                      onChange={(data: EditorData) => handleInputChange('lead', data.content)}
                    />
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

  return (
    <>
      <div class={styles.container}>
        <form>
          <div class="wide-container">
            <button
              class={clsx(styles.scrollTopButton, {
                [styles.visible]: isScrolled()
              })}
              onClick={handleScrollTopButtonClick}
            >
              <Icon name="up-button" class={styles.icon} />
              <span class={styles.scrollTopButtonLabel}>{t('Scroll up')}</span>
            </button>

            <div class={styles.wrapperTableOfContents}>
              <Show when={isDesktop() && currentDraft()?.body}>
                <TableOfContents
                  variant="editor"
                  parentSelector="#editorBody"
                  body={currentDraft()?.body || ''}
                />
              </Show>
            </div>

            <div class="row">
              <HeadingActions />
            </div>
            <Show when={currentDraft()?.id} fallback={<Loading />}>
              <SimpleRichEditor
                commands={['bold', 'italic', 'link', 'blockquote', 'image']}
                plus={true}
                bubble={true}
                editorId={`editor-${currentDraft()?.id}`}
                content={currentDraft()?.body || ''}
                readOnly={false}
                limit={10000}
                onChange={(data: EditorData) => handleInputChange('body', data.content)}
              />
              <Show when={currentDraft()?.id}>
                <Panel shoutId={currentDraft()?.id} />
              </Show>
            </Show>
          </div>
        </form>
      </div>

      <Modal variant="medium" name="inviteCoauthors">
        <InviteMembers variant={'coauthors'} title={t('Invite experts')} />
      </Modal>
    </>
  )
}

export default EditView
