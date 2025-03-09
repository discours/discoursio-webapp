import { A, useLocation, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js'

import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useNotifications } from '~/context/notifications'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'
import type { Author } from '~/graphql/schema/core.gen'
import { Userpic } from '../Author/Userpic'
import { ProfilePopup } from '../ProfileNav/ProfilePopup'
import { Button } from '../_shared/Button'
import { Icon } from '../_shared/Icon'
import { Popover } from '../_shared/Popover'
import { Popup } from '../_shared/Popup'

import styles from './Header.module.scss'

type Props = {
  setIsProfilePopupVisible: (value: boolean) => void
  showInboxButton?: boolean
}

type IconedButtonProps = {
  value: string
  icon: string
  action: () => void
}

const MD_WIDTH_BREAKPOINT = 992

// Компонент для режима редактирования
const EditingHeader = (props: Props) => {
  const { t } = useLocalize()
  const { publishDraft, currentDraft, toggleEditorPanel } = useDrafts()
  const [width, setWidth] = createSignal(0)
  const [editorMode, setEditorMode] = createSignal(t('Editing'))

  createEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    onCleanup(() => window.removeEventListener('resize', handleResize))
  })

  const IconedButton = (props: IconedButtonProps) => {
    return (
      <Show
        when={width() < MD_WIDTH_BREAKPOINT}
        fallback={
          <Button
            value={<span class={styles.textLabel}>{props.value}</span>}
            variant={'light'}
            onClick={props.action}
            class={styles.editorControl}
          />
        }
      >
        <Popover content={props.value}>
          {(ref) => (
            <Button
              ref={ref}
              variant={'light'}
              onClick={props.action}
              value={<Icon name={props.icon} class={styles.icon} />}
              class={styles.editorControl}
            />
          )}
        </Popover>
      </Show>
    )
  }
  const { session } = useSession()
  const loc = useLocation()
  const author = createMemo(() => session()?.user?.app_data?.profile as Author)
  const matchProfile = createMemo(() => loc.pathname.endsWith(author()?.slug))

  return (
    <>
      <EditingSelector mode={editorMode()} setMode={setEditorMode} />

      <div class={clsx(styles.userControlItem, styles.userControlItemVerbose)}>
        <IconedButton
          value={t('Publish')}
          icon="publish"
          action={() => publishDraft(currentDraft()?.id || 0)}
        />
      </div>

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
      </div>
    </>
  )
}

// Компонент для авторизованного режима
const AuthorizedHeader = (props: Props) => {
  const { t } = useLocalize()
  const { session } = useSession()
  const { unreadNotificationsCount, showNotificationsPanel } = useNotifications()
  const navigate = useNavigate()
  const loc = useLocation()
  const author = createMemo(() => session()?.user?.app_data?.profile as Author)
  const matchProfile = createMemo(() => loc.pathname.endsWith(author()?.slug))
  const matchInbox = createMemo(() => loc.pathname.endsWith('inbox'))

  const handleBellIconClick = (event: Event) => {
    event.preventDefault()
    showNotificationsPanel()
  }

  const handleCreatePostClick = (event: Event) => {
    event.preventDefault()
    navigate('/edit/new')
  }

  return (
    <>
      <div class={styles.userControlItem} onClick={handleBellIconClick}>
        <div class={styles.button}>
          <Icon name="bell-white" counter={unreadNotificationsCount?.() || 0} class={styles.icon} />
          <Icon
            name="bell-white-hover"
            counter={unreadNotificationsCount?.() || 0}
            class={clsx(styles.icon, styles.iconHover)}
          />
        </div>
      </div>

      <div
        class={clsx(styles.userControlItem, styles.userControlItemVerbose, styles.userControlItemCreate)}
      >
        <button onClick={handleCreatePostClick}>
          <span class={styles.textLabel}>{t('Create post')}</span>
          <Icon name="pencil-outline" class={styles.icon} />
          <Icon name="pencil-outline-hover" class={clsx(styles.icon, styles.iconHover)} />
        </button>
      </div>

      {props.showInboxButton && (
        <div class={clsx(styles.userControlItem, styles.userControlItemInbox)}>
          <A href={'/inbox'}>
            <div classList={{ entered: Boolean(matchInbox()) }}>
              <Icon name="inbox-white" class={styles.icon} />
              <Icon name="inbox-white-hover" class={clsx(styles.icon, styles.iconHover)} />
            </div>
          </A>
        </div>
      )}

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
