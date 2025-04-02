import { A, useLocation, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { Show, createMemo } from 'solid-js'

import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'
import type { Author } from '~/graphql/schema/core.gen'
import { Userpic } from '../Author/Userpic'
import { ProfilePopup } from '../ProfileNav/ProfilePopup'
import { Button } from '../_shared/Button'
import { Icon } from '../_shared/Icon'
import { Popover } from '../_shared/Popover'
import { Popup } from '../_shared/Popup'
import NotificationsBell from './NotificationsBell'

import styles from './Header.module.scss'

type Props = {
  setIsProfilePopupVisible: (value: boolean) => void
  showInboxButton?: boolean
}

// Компонент для режима редактирования
const EditingHeader = (props: Props) => {
  const { t } = useLocalize()
  const { toggleEditorPanel } = useDrafts()
  const { session } = useSession()
  const loc = useLocation()
  const author = createMemo(() => session()?.user?.app_data?.profile as Author)
  const matchProfile = createMemo(() => loc.pathname.endsWith(author()?.slug))

  return (
    <>
      <ProfilePopup
        onVisibilityChange={props.setIsProfilePopupVisible}
        containerCssClass={styles.control}
        trigger={
          <div class={clsx(styles.userControlItem, styles.userControlItemUserpic)}>
            <button class={styles.button}>
              <div classList={{ entered: Boolean(matchProfile()) }}>
                <Userpic
                  size={'L'}
                  name={author()?.name || ''}
                  userpic={author()?.pic || ''}
                  class={styles.userpic}
                />
              </div>
            </button>
          </div>
        }
      />

      <EditingSelector mode={t('Editing')} setMode={toggleEditorPanel} />

      <NotificationsBell />

      <div
        class={clsx(styles.userControlItem, styles.settingsControlContainer, styles.userControlItemVerbose)}
      >
        <Popover content={t('Settings')}>
          {(ref) => (
            <Button
              ref={ref}
              value={<Icon name="ellipsis" />}
              variant={'light'}
              onClick={toggleEditorPanel}
              class={styles.settingsControl}
            />
          )}
        </Popover>
      </div>
    </>
  )
}

// Компонент для авторизованного режима
const AuthorizedHeader = (props: Props) => {
  const { t } = useLocalize()
  const { session } = useSession()
  const navigate = useNavigate()
  const loc = useLocation()
  const author = createMemo(() => session()?.user?.app_data?.profile as Author)
  const matchProfile = createMemo(() => loc.pathname.endsWith(author()?.slug))
  const matchInbox = createMemo(() => loc.pathname.endsWith('inbox'))

  const handleCreatePostClick = (event: Event) => {
    event.preventDefault()
    navigate('/edit/new')
  }

  return (
    <>
      <NotificationsBell />

      <div
        class={clsx(styles.userControlItem, styles.userControlItemVerbose, styles.userControlItemCreate)}
      >
        <button onClick={handleCreatePostClick}>
          <span class={styles.textLabel}>{t('Create post')}</span>
          <Icon name="pencil-outline" class={styles.icon} />
          <Icon name="pencil-outline-hover" class={clsx(styles.icon, styles.iconHover)} />
        </button>
      </div>

      <Show when={props.showInboxButton}>
        <div class={clsx(styles.userControlItem, styles.userControlItemInbox)}>
          <A href={'/inbox'}>
            <div classList={{ entered: Boolean(matchInbox()) }}>
              <Icon name="inbox-white" class={styles.icon} />
              <Icon name="inbox-white-hover" class={clsx(styles.icon, styles.iconHover)} />
            </div>
          </A>
        </div>
      </Show>

      <ProfilePopup
        onVisibilityChange={props.setIsProfilePopupVisible}
        containerCssClass={styles.control}
        trigger={
          <div class={clsx(styles.userControlItem, styles.userControlItemUserpic)}>
            <button class={styles.button}>
              <div classList={{ entered: Boolean(matchProfile()) }}>
                <Userpic
                  size={'L'}
                  name={author()?.name || ''}
                  userpic={author()?.pic || ''}
                  class={styles.userpic}
                />
              </div>
            </button>
          </div>
        }
      />
    </>
  )
}

// Компонент для гостевого режима
const GuestHeader = () => {
  const { t } = useLocalize()
  const { showModal } = useUI()

  const handleCreatePostClick = (event: Event) => {
    event.preventDefault()
    showModal('auth')
  }

  return (
    <>
      <div
        class={clsx(styles.userControlItem, styles.userControlItemVerbose, styles.userControlItemCreate)}
      >
        <button onClick={handleCreatePostClick}>
          <span class={styles.textLabel}>{t('Create post')}</span>
          <Icon name="pencil-outline" class={styles.icon} />
          <Icon name="pencil-outline-hover" class={clsx(styles.icon, styles.iconHover)} />
        </button>
      </div>

      <div class={clsx(styles.userControlItem, styles.userControlItemVerbose, 'loginbtn')}>
        <A href="?m=auth&mode=login">
          <span class={styles.textLabel}>{t('Enter')}</span>
          <Icon name="key" class={styles.icon} />
          <Icon name="key" class={clsx(styles.icon, styles.iconHover)} />
        </A>
      </div>
    </>
  )
}

// Компонент выбора режима редактора
const EditingSelector = (props: { mode: string; setMode: (mode: string) => void }) => {
  const { t } = useLocalize()

  return (
    <Popup
      trigger={
        <span class={styles.editorModePopupOpener}>
          <Icon name="swiper-r-arr" class={styles.editorModePopupOpenerIcon} />
          {props.mode}
        </span>
      }
      popupCssClass={styles.editorPopup}
    >
      <ul class={clsx('nodash', styles.editorModesList)}>
        <li
          class={clsx({ [styles.editorModesSelected]: props.mode === t('Preview') })}
          onClick={() => props.setMode(t('Preview'))}
        >
          <Icon name="eye" class={styles.editorModeIcon} />
          <div class={styles.editorModeTitle}>{t('Preview')}</div>
          <div class={styles.editorModeDescription}>
            {t('Look at how the material will look when published')}
          </div>
        </li>
        <li
          class={clsx({ [styles.editorModesSelected]: props.mode === t('Editing') })}
          onClick={() => props.setMode(t('Editing'))}
        >
          <Icon name="pencil-outline" class={styles.editorModeIcon} />
          <div class={styles.editorModeTitle}>{t('Editing')}</div>
          <div class={styles.editorModeDescription}>{t('Edit the text directly in the editor')}</div>
        </li>
        <li
          class={clsx({ [styles.editorModesSelected]: props.mode === t('Commenting') })}
          onClick={() => props.setMode(t('Commenting'))}
        >
          <Icon name="comment" class={styles.editorModeIcon} />
          <div class={styles.editorModeTitle}>{t('Commenting')}</div>
          <div class={styles.editorModeDescription}>
            {t('Suggest edits and comments to make the material better')}
          </div>
        </li>
      </ul>
    </Popup>
  )
}

// Основной компонент HeaderControls
export const HeaderControls = (props: Props) => {
  const { session } = useSession()
  const loc = useLocation()

  const isEditingMode = createMemo(() => loc.pathname.startsWith('/edit/') && !loc.pathname.endsWith('new'))
  const isAuthorized = createMemo(() => !!session()?.access_token)

  return (
    <div class={clsx('col-auto col-lg-7', styles.usernav)}>
      <div class={styles.userControl}>
        <Show
          when={isEditingMode()}
          fallback={
            <Show when={isAuthorized()} fallback={<GuestHeader />}>
              <AuthorizedHeader {...props} />
            </Show>
          }
        >
          <EditingHeader {...props} />
        </Show>
      </div>
    </div>
  )
}
