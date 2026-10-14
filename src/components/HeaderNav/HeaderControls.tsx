import { A, useLocation, useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { createMemo, Show, Suspense } from 'solid-js'

import { useConnect } from '~/context/connect'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { useProfile } from '~/context/profile'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'
import { Button } from '../_shared/Button'
import { Icon } from '../_shared/Icon'
import { Popover } from '../_shared/Popover'
import { Popup } from '../_shared/Popup'
import { Userpic } from '../Author/Userpic'
import { PublishButton } from '../Draft/PublishButton'
import { ProfilePopup } from '../ProfileNav/ProfilePopup'
import styles from './Header.module.scss'
import NotificationsBell from './NotificationsBell'

type Props = {
  setIsProfilePopupVisible: (value: boolean) => void
  showInboxButton?: boolean
}

// Компонент индикатора подключения
const ConnectionIndicator = () => {
  const connectContext = useConnect()
  const isConnected = () => connectContext.getStatus() === 'connected'
  const { t } = useLocalize()

  const handleClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isConnected()) {
      console.log('[ConnectionIndicator] Connection status:', connectContext.getStatus())
      // Отмечаем, что reconnect больше недоступен
      console.warn('[ConnectionIndicator] Manual reconnect is no longer available')
    }
  }

  // Подготовка контента для Popover
  const popoverContent = () => {
    if (isConnected()) {
      return (
        <div>
          <div>{t('Connected to server')}</div>
          <div class={styles.popoverSubtext}>{t('Collaborative editing enabled')}</div>
        </div>
      )
    } else {
      return (
        <div>
          <div>{t('Disconnected from server')}</div>
          <div class={styles.popoverSubtext}>{`${t('Connection status')}: ${t(connectContext.getStatus())}`}</div>
          <div class={styles.popoverSubtext}>{t('Changes saved locally')}</div>
        </div>
      )
    }
  }

  return (
    <Popover content={popoverContent()}>
      {(ref) => (
        <div
          ref={ref}
          class={clsx(styles.connectionIndicator, {
            [styles.connected]: isConnected(),
            [styles.disconnected]: !isConnected()
          })}
          onClick={handleClick}
        >
          <div class={styles.indicatorDot} />
        </div>
      )}
    </Popover>
  )
}

// Компонент для режима редактирования
const EditingHeader = (props: Props) => {
  const { t } = useLocalize()
  const { toggleEditorPanel } = useDrafts()
  const { session, isSessionValidating } = useSession()
  const { showModal } = useUI()
  const { isUploadingAvatar } = useProfile()
  const loc = useLocation()
  const author = createMemo(() => session()?.author || null)
  const matchProfile = createMemo(() => {
    const authorSlug = author()?.slug
    return authorSlug ? loc.pathname.endsWith(authorSlug) : false
  })

  const handleSearchClick = (event: Event) => {
    event.preventDefault()
    showModal('search')
  }

  return (
    <>
      <Show when={!(loc.pathname.startsWith('/edit/') && loc.pathname.endsWith('/settings'))}>
        <div class={styles.editorControls}>
          <ConnectionIndicator />
          <span class={styles.editorModePopupOpener}>
            <EditingSelector />
          </span>
        </div>
      </Show>

      {/* Кнопка поиска согласно дизайну */}
      <div class={clsx(styles.userControlItem, styles.userControlItemSearch)}>
        <button type="button" class={styles.button} onClick={handleSearchClick} title={t('Search')}>
          <Icon name="search" />
        </button>
      </div>

      <Suspense>
        <ProfilePopup
          onVisibilityChange={props.setIsProfilePopupVisible}
          containerCssClass={styles.control}
          trigger={
            <div class={clsx(styles.userControlItem, styles.userControlItemUserpic)}>
              <button type="button" class={styles.button}>
                <div classList={{ entered: Boolean(matchProfile()) }}>
                  <Userpic
                    size={'L'}
                    name={author()?.name || ''}
                    userpic={author()?.pic || ''}
                    class={styles.userpic}
                    loading={isSessionValidating() || isUploadingAvatar()}
                  />
                </div>
              </button>
            </div>
          }
        />
      </Suspense>

      <Show when={!(loc.pathname.startsWith('/edit/') && loc.pathname.endsWith('/settings'))}>
        <div class={styles.editorControls}>
          <span class={styles.notificationsBellContainer}>
            <NotificationsBell />
          </span>
          <PublishButton />
        </div>
      </Show>

      <div class={clsx(styles.userControlItem, styles.settingsControlContainer, styles.userControlItemVerbose)}>
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
  const { session, isSessionValidating } = useSession()
  const { showModal } = useUI()
  const { isUploadingAvatar } = useProfile()
  const loc = useLocation()
  const author = createMemo(() => session()?.author || null)
  const matchProfile = createMemo(() => {
    const authorSlug = author()?.slug
    return authorSlug ? loc.pathname.endsWith(authorSlug) : false
  })

  const handleSearchClick = (event: Event) => {
    event.preventDefault()
    showModal('search')
  }

  return (
    <>
      <div class={clsx(styles.userControlItem, styles.userControlItemSearch)}>
        <button type="button" class={styles.button} onClick={handleSearchClick} title={t('Search')}>
          <Icon name="search" />
        </button>
      </div>

      <NotificationsBell />

      <Suspense>
        <ProfilePopup
          onVisibilityChange={props.setIsProfilePopupVisible}
          containerCssClass={styles.control}
          trigger={
            <div class={clsx(styles.userControlItem, styles.userControlItemUserpic)}>
              <button type="button" class={styles.button}>
                <div classList={{ entered: Boolean(matchProfile()) }}>
                  <Userpic
                    size={'L'}
                    name={author()?.name || ''}
                    userpic={author()?.pic || ''}
                    class={styles.userpic}
                    loading={isSessionValidating() || isUploadingAvatar()}
                  />
                </div>
              </button>
            </div>
          }
        />
      </Suspense>
    </>
  )
}

// Компонент для гостевого режима
const GuestHeader = () => {
  const { t } = useLocalize()
  const { showModal } = useUI()

  const handleSearchClick = (event: Event) => {
    event.preventDefault()
    showModal('search')
  }

  return (
    <>
      <div class={clsx(styles.userControlItem, styles.userControlItemSearch)}>
        <button type="button" class={styles.button} onClick={handleSearchClick} title={t('Search')}>
          <Icon name="search" />
        </button>
      </div>

      <NotificationsBell />

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
const EditingSelector = () => {
  const { t } = useLocalize()
  const navigate = useNavigate()
  const loc = useLocation()

  /**
   * Извлекает базовый путь редактора (например, /edit/draft-id).
   * @returns {string} Базовый путь.
   */
  const getBasePath = (): string => {
    const parts = loc.pathname.split('/')
    // Убедимся, что путь начинается с /edit/ и есть ID
    if (parts.length >= 3 && parts[1] === 'edit' && parts[2]) {
      // Возвращаем только /edit/[id], отбрасывая /preview, /suggest, /settings и т.д.
      return `/edit/${parts[2]}`
    }
    // Резервный вариант или обработка ошибки
    console.warn('[EditingSelector] Не удалось определить базовый путь из:', loc.pathname)
    if (loc.pathname === '/edit/') {
      return '/edit'
    }
    return ''
  }

  // Используем createMemo для кэширования путей
  const basePath = createMemo(getBasePath)
  const previewPath = createMemo(() => `${basePath()}/preview`)
  const editingPath = createMemo(() => basePath()) // Базовый путь - это и есть путь редактирования
  const suggestPath = createMemo(() => `${basePath()}/suggest`)

  /**
   * Определяет текущий режим редактирования на основе URL.
   * @returns {string} Локализованная строка текущего режима.
   */
  const currentMode = createMemo((): string => {
    const pathname = loc.pathname
    if (pathname === previewPath()) return t('Preview')
    // Режим предложений временно отключен
    // if (pathname === suggestPath()) return t('Ask and suggest')
    // Режим редактирования - это базовый путь или любой другой подпуть (например, /settings)
    if (pathname.startsWith(basePath())) return t('Editing')

    return t('Editing') // Резервный вариант по умолчанию
  })

  /**
   * Выполняет навигацию по указанному пути.
   * @param {string} path - Целевой путь.
   */
  const navigateTo = (path: string) => {
    navigate(path)
  }

  return (
    <Popup
      trigger={
        <div class={styles.editorModePopupOpener}>
          <Icon name="swiper-r-arr" class={styles.editorModePopupOpenerIcon} />
          {/* Отображаем текущий режим на основе маршрута */}
          {currentMode()}
        </div>
      }
      popupCssClass={styles.editorPopup}
    >
      <ul class={clsx('nodash', styles.editorModesList)}>
        {/* Режим просмотра */}
        <li
          // Выделяем, если текущий путь совпадает с путем просмотра
          class={clsx({ [styles.editorModesSelected]: loc.pathname === previewPath() })}
          onClick={() => navigateTo(previewPath())}
        >
          <Icon name="eye" class={styles.editorModeIcon} />
          <div class={styles.editorModeTitle}>{t('Preview')}</div>
          <div class={styles.editorModeDescription}>{t('This is how the post will look when published')}</div>
        </li>
        {/* Режим редактирования */}
        <li
          // Выделяем, если текущий путь - это базовый путь редактирования
          class={clsx({ [styles.editorModesSelected]: loc.pathname === editingPath() })}
          onClick={() => navigateTo(editingPath())}
        >
          <Icon name="pencil-outline" class={styles.editorModeIcon} />
          <div class={styles.editorModeTitle}>{t('Editing')}</div>
          <div class={styles.editorModeDescription}>{t('Edit the text directly in the editor')}</div>
        </li>
        {/* Режим предложений правок - временно отключен */}
        <li
          // Заблюрен до готовности функционала
          class={clsx({ [styles.editorModesSelected]: loc.pathname === suggestPath() }, 'editorModeDisabled')}
          onClick={() => {
            // Временно отключено
            console.log('Режим предложений правок в разработке')
          }}
        >
          <Icon name="comment" class={styles.editorModeIcon} />
          <div class={styles.editorModeTitle}>{t('Ask and suggest')} (скоро)</div>
          <div class={styles.editorModeDescription}>{t('Feature in development')}</div>
        </li>
      </ul>
    </Popup>
  )
}

// Основной компонент HeaderControls
export const HeaderControls = (props: Props) => {
  const { session, isSessionValidating } = useSession()
  const loc = useLocation()

  const isEditingMode = createMemo(() => loc.pathname.startsWith('/edit/') && !loc.pathname.endsWith('new'))

  // Правильная логика определения авторизации: есть сессия с токеном И автором
  const isAuthorized = createMemo(() => Boolean(session()?.token && session()?.author) || isSessionValidating())

  return (
    <div class={clsx(styles.usernav)}>
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
