import { createFileUploader, UploadFile } from '@solid-primitives/upload'
import { clsx } from 'clsx'
import deepEqual from 'fast-deep-equal'
import { createEffect, createSignal, For, lazy, Match, on, onCleanup, onMount, Show, Switch } from 'solid-js'
import { createStore } from 'solid-js/store'
import { toast } from 'solid-toast'
import { useLocalize } from '~/context/localize'
import { useProfile } from '~/context/profile'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'
import { useUpload } from '~/context/upload'
import { ProfileInput } from '~/graphql/generated/graphql'
import { profileSocialLinks } from '~/lib/profileSocialLinks'
import styles from '~/styles/views/ProfileSettings.module.scss'
import { clone } from '~/utils/clone'
import { validateUrl } from '~/utils/validate'
import { Button } from '../_shared/Button'
import { Icon } from '../_shared/Icon'
import { ImageCropper } from '../_shared/ImageCropper'
import { Loading } from '../_shared/Loading'
import { Modal } from '../_shared/Modal'
import { Popover } from '../_shared/Popover'
import { SocialNetworkInput } from '../_shared/SocialNetworkInput'
import { ProfileSettingsNavigation } from '../ProfileNav'
import { sanitizeHtml } from '../SimpleRichEditor/lib/sanitize'
import { EditorData } from '../SimpleRichEditor/lib/types'
import { SimpleRichEditor } from '../SimpleRichEditor/SimpleRichEditor'

const GrowingTextarea = lazy(() => import('~/components/_shared/GrowingTextarea/GrowingTextarea'))

function filterNulls(arr: (string | null | undefined)[]): string[] {
  return arr.filter((item): item is string => item !== null && item !== undefined)
}

export const ProfileSettings = () => {
  const { t } = useLocalize()
  const [isFormInitialized, setIsFormInitialized] = createSignal(false)
  const [isSaving, setIsSaving] = createSignal(false)
  const [social, setSocial] = createSignal<string[]>([])
  const [addLinkForm, setAddLinkForm] = createSignal<boolean>(false)
  const [incorrectUrl, setIncorrectUrl] = createSignal<boolean>(false)
  const [isUserpicUpdating, setIsUserpicUpdating] = createSignal(false)
  const [userpicFile, setUserpicFile] = createSignal<UploadFile>()
  const [uploadError, setUploadError] = createSignal(false)
  const [isFloatingPanelVisible, setIsFloatingPanelVisible] = createSignal(false)
  const [hostname, setHostname] = createSignal<string | null>(null)
  const [slugError, setSlugError] = createSignal<string>()
  const [nameError, setNameError] = createSignal<string>()
  const { form, submit, updateFormField, setForm } = useProfile()
  const { loadSession, session } = useSession()
  const [prevForm, setPrevForm] = createStore<ProfileInput>({} as ProfileInput)
  const { showConfirm } = useUI()
  const { showModal, hideModal } = useUI()
  const { uploadImage } = useUpload()
  const [loading, setLoading] = createSignal(true)

  // Используем createEffect для отслеживания данных сессии и инициализации формы
  createEffect(() => {
    const s = session()
    if (s && !isFormInitialized()) {
      const profileData = s?.author
      if (profileData) {
        setPrevForm(profileData)
        const soc: string[] = filterNulls(profileData.links || [])
        setSocial(soc)
        setForm(profileData) // Инициализируем форму с данными профиля
        setIsFormInitialized(true)
      }
      setLoading(false) // Отключаем загрузку только после инициализации данных
    }
  })

  let slugInputRef: HTMLInputElement | null
  let nameInputRef: HTMLInputElement | null

  const handleChangeSocial = (value: string) => {
    if (validateUrl(value)) {
      updateFormField('links', value)
      setAddLinkForm(false)
    } else {
      setIncorrectUrl(true)
    }
  }

  const handleSubmit = async (event: MouseEvent | undefined) => {
    event?.preventDefault()
    setIsSaving(true)
    if (nameInputRef?.value.length === 0) {
      setNameError(t('Required'))
      nameInputRef?.focus()
      setIsSaving(false)
      return
    }
    if (slugInputRef?.value.length === 0) {
      setSlugError(t('Required'))
      slugInputRef?.focus()
      setIsSaving(false)
      return
    }

    try {
      // Отправляем все данные формы, включая bio
      await submit(form)
      setPrevForm(clone(form))
      toast.success(t('Profile successfully saved'))
    } catch (error) {
      if (error?.toString().search('duplicate_slug')) {
        setSlugError(t('The address is already taken'))
        slugInputRef?.focus()
        return
      }
      toast.error(t('Error'))
    } finally {
      setIsSaving(false)
    }

    setTimeout(loadSession, 5000) // renews author's profile
  }

  const handleCancel = async () => {
    const isConfirmed = await showConfirm({
      confirmBody: t('Do you really want to reset all changes?'),
      confirmButtonVariant: 'primary',
      declineButtonVariant: 'secondary'
    })
    isConfirmed && setForm(clone(prevForm))
  }

  const handleCropAvatar = () => {
    const { selectFiles } = createFileUploader({ multiple: false, accept: 'image/*' })

    selectFiles(([uploadFile]) => {
      setUserpicFile(uploadFile as UploadFile)

      showModal('cropImage')
    })
  }

  const handleUploadAvatar = async (uploadFile: UploadFile) => {
    try {
      setUploadError(false)
      setIsUserpicUpdating(true)

      console.log('[ProfileSettings] Starting avatar upload:', uploadFile.name)
      const url = await uploadImage(uploadFile.file)
      console.log('[ProfileSettings] Upload successful, URL:', url)

      updateFormField('pic', url)
      setUserpicFile(undefined)
      hideModal()
      setIsUserpicUpdating(false)

      toast.success(t('Avatar uploaded successfully'))
    } catch (error) {
      setUploadError(true)
      setIsUserpicUpdating(false)
      console.error('[ProfileSettings] Upload avatar error:', error)
      toast.error(error instanceof Error ? error.message : t('Upload error'))
    }
  }

  onMount(() => {
    setHostname(window?.location.host)

    // eslint-disable-next-line unicorn/consistent-function-scoping
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!deepEqual(form, prevForm)) {
        event.returnValue = t(
          'There are unsaved changes in your profile settings. Are you sure you want to leave the page without saving?'
        )
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    onCleanup(() => window.removeEventListener('beforeunload', handleBeforeUnload))
  })

  createEffect(
    on(
      () => deepEqual(form, prevForm),
      () => {
        if (Object.keys(prevForm).length > 0) {
          setIsFloatingPanelVisible(!deepEqual(form, prevForm))
        }
      }
    )
  )

  const handleDeleteSocialLink = (link: string) => {
    updateFormField('links', link, true)
  }

  const slugUpdate = (ev: InputEvent) => {
    const input = (ev.target || ev.currentTarget) as HTMLInputElement
    const value = input.value
    const newValue = value.startsWith('@') || value.startsWith('!') ? value.substring(1) : value
    input.value = newValue
    updateFormField('slug', newValue)
  }

  return (
    <Show when={Object.keys(form).length > 0 && isFormInitialized() && !loading()} fallback={<Loading />}>
      <>
        <div class="wide-container">
          <div class="row">
            <div class="col-md-5">
              <div class={clsx('left-navigation', styles.leftNavigation)}>
                <ProfileSettingsNavigation />
              </div>
            </div>
            <div class="col-md-19">
              <div class="row">
                <div class="col-md-20 col-lg-18 col-xl-16">
                  <h1>{t('Profile settings')}</h1>
                  <p class="description">{t('Here you can customize your profile the way you want.')}</p>
                  <form enctype="multipart/form-data" autocomplete="off">
                    <h4>{t('Userpic')}</h4>
                    <div class="pretty-form__item">
                      <div class={clsx(styles.userpic, { [styles.hasControls]: form.pic })}>
                        <Switch>
                          <Match when={isUserpicUpdating()}>
                            <Loading />
                          </Match>
                          <Match when={form.pic}>
                            <div class={styles.userpicImage} style={{ 'background-image': `url(${form.pic})` }} />
                            <div class={styles.controls}>
                              <Popover content={t('Delete userpic')}>
                                {(triggerRef: (el: HTMLElement) => void) => (
                                  <button
                                    ref={triggerRef}
                                    class={styles.control}
                                    onClick={() => updateFormField('pic', '')}
                                  >
                                    <Icon name="close" />
                                  </button>
                                )}
                              </Popover>

                              {/* NOTE: onClick на кнопке без propagation */}
                              <Popover content={t('Upload userpic')}>
                                {(triggerRef: (el: HTMLElement) => void) => (
                                  <button
                                    ref={triggerRef}
                                    class={styles.control}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCropAvatar()
                                    }}
                                  >
                                    <Icon name="user-image-black" />
                                  </button>
                                )}
                              </Popover>
                            </div>
                          </Match>
                          <Match when={!form.pic}>
                            <div onClick={handleCropAvatar} style={{ cursor: 'pointer', width: '100%' }}>
                              <Icon name="user-image-gray" />
                              {t('Here you can upload your photo')}
                            </div>
                          </Match>
                        </Switch>
                      </div>
                      <Show when={uploadError()}>
                        <div class={styles.error}>{t('Upload error')}</div>
                      </Show>
                    </div>
                    <h4>{t('Name')}</h4>
                    <p class="description">
                      {t(
                        'Your name will appear on your profile page and as your signature in publications, comments and responses.'
                      )}
                    </p>
                    <div class="pretty-form__item">
                      <label for="nameOfUser">
                        <input
                          type="text"
                          name="nameOfUser"
                          id="nameOfUser"
                          data-lpignore="true"
                          autocomplete="name"
                          placeholder={t('Name')}
                          onInput={(event) => updateFormField('name', event.currentTarget.value)}
                          value={form.name || ''}
                          ref={(el) => (nameInputRef = el)}
                        />
                        {t('Name')}
                      </label>
                      <Show when={nameError()}>
                        <div
                          style={{ position: 'absolute', 'margin-top': '-4px' }}
                          class="form-message form-message--error"
                        >
                          {t(`${nameError()}`)}
                        </div>
                      </Show>
                    </div>

                    <h4>{t('Address on Discours')}</h4>
                    <div class="pretty-form__item">
                      <div class={styles.discoursName}>
                        <label for="user-address">{hostname()}/@</label>
                        <div class={styles.discoursNameField}>
                          <input
                            type="text"
                            name="user-address"
                            id="user-address"
                            data-lpignore="true"
                            autocomplete="off"
                            onInput={slugUpdate}
                            value={form.slug || ''}
                            ref={(el) => (slugInputRef = el)}
                            class="nolabel"
                          />
                          <Show when={slugError()}>
                            <p class="form-message form-message--error">{t(`${slugError()}`)}</p>
                          </Show>
                        </div>
                      </div>
                    </div>

                    <h4>{t('Introduce')}</h4>
                    <GrowingTextarea
                      variant="bordered"
                      placeholder={t('Introduce')}
                      initialValue={form.bio || ''}
                      allowEnterKey={false}
                      maxLength={120}
                      onChange={(value) => updateFormField('bio', String(sanitizeHtml(value)))}
                    />

                    <h4>{t('About')}</h4>
                    <SimpleRichEditor
                      content={form.about || ''}
                      commands={['bold', 'italic', 'link', 'blockquote', 'image']}
                      onChange={(data: EditorData) => updateFormField('about', String(sanitizeHtml(data.content)))}
                      placeholder={t('About')}
                      editorId={`profile-about-${session()?.author?.id || ''}`}
                      fieldType="about"
                      toolbar="top"
                    />
                    <div class={clsx(styles.multipleControls, 'pretty-form__item')}>
                      <div class={styles.multipleControlsHeader}>
                        <h4>{t('Social networks')}</h4>
                        <button type="button" class="button" onClick={() => setAddLinkForm(!addLinkForm())}>
                          +
                        </button>
                      </div>
                      <Show when={addLinkForm()}>
                        <SocialNetworkInput
                          isExist={false}
                          autofocus={true}
                          handleInput={(value) => handleChangeSocial(value)}
                        />
                        <Show when={incorrectUrl()}>
                          <p class="form-message form-message--error">{t('It does not look like url')}</p>
                        </Show>
                      </Show>
                      <Show when={social()}>
                        <For each={profileSocialLinks(social())}>
                          {(network) => (
                            <SocialNetworkInput
                              class={styles.socialInput}
                              link={network.link}
                              network={network.name}
                              handleInput={(value) => handleChangeSocial(value)}
                              isExist={!network.isPlaceholder}
                              slug={form.slug || ''}
                              handleDelete={() => handleDeleteSocialLink(network.link)}
                            />
                          )}
                        </For>
                      </Show>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Show when={isFloatingPanelVisible()}>
          <div class={styles.formActions}>
            <div class="wide-container">
              <div class="row">
                <div class="col-md-19 offset-md-5">
                  <div class="row">
                    <div class="col-md-20 col-lg-18 col-xl-16">
                      <div class={styles.content}>
                        <Button
                          class={styles.cancel}
                          variant="light"
                          value={
                            <>
                              <span class={styles.cancelLabel}>{t('Cancel changes')}</span>
                              <span class={styles.cancelLabelMobile}>{t('Cancel')}</span>
                            </>
                          }
                          onClick={handleCancel}
                        />
                        <Button
                          onClick={handleSubmit}
                          variant="primary"
                          disabled={isSaving()}
                          value={isSaving() ? t('Saving...') : t('Save settings')}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Show>
        <Modal variant="medium" name="cropImage" onClose={() => setUserpicFile(undefined)}>
          <h2>{t('Crop image')}</h2>

          <Show when={Boolean(userpicFile())}>
            <ImageCropper
              uploadFile={userpicFile() as UploadFile}
              onSave={(data: File) => {
                const uploadFile: UploadFile = {
                  source: data.name,
                  file: data,
                  name: data.name,
                  size: data.size
                }
                void handleUploadAvatar(uploadFile)

                hideModal()
              }}
              onDecline={() => hideModal()}
            />
          </Show>
        </Modal>
      </>
    </Show>
  )
}
