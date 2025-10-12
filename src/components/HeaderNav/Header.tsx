import { A, redirect, useLocation, useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { createEffect, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { isServer, NoHydration } from 'solid-js/web'
import { Toaster } from 'solid-sonner'
import { useLocalize } from '~/context/localize'
import { useNotifications } from '~/context/notifications'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'
import { capitalize } from '~/utils/capitalize'
import { ConfirmModal } from '../_shared/ConfirmModal'
import { Icon } from '../_shared/Icon'
import { Modal } from '../_shared/Modal'
import { Newsletter } from '../_shared/Newsletter'
import { getShareUrl, SharePopup } from '../Article/SharePopup'
import { AuthModal } from '../AuthModal'
import { Feedback } from '../Discours/Feedback'
import stylesFeedSwitcher from '../Feed/FeedSwitcher/FeedSwitcher.module.scss'
import { SearchModal } from '../SearchModal/SearchModal'
import styles from './Header.module.scss'
import { HeaderControls } from './HeaderControls'
import { TopicsNav } from './TopicsNav'

type Props = {
  title?: string
  slug?: string
  isHeaderFixed?: boolean
  desc?: string
  cover?: string
}

type HeaderSearchParams = {
  source?: string
}

const handleSwitchLanguage = (event: { target: { value: string } }) => {
  location.href = `${location.href}${location.href.includes('?') ? '&' : '?'}lng=${event.target.value}`
}

export const Header = (props: Props) => {
  const { t, lang } = useLocalize()
  const loc = useLocation()
  const { modal } = useUI()
  const { session } = useSession()
  const { isNotificationsPanelOpen } = useNotifications()
  const [searchParams, changeSearchParams] = useSearchParams<HeaderSearchParams>()
  const [getIsScrollingBottom, setIsScrollingBottom] = createSignal(false)
  const [getIsScrolled, setIsScrolled] = createSignal(false)
  const [fixed, setFixed] = createSignal(false)
  const [isSharePopupVisible, setIsSharePopupVisible] = createSignal(false)
  const [isProfilePopupVisible, setIsProfilePopupVisible] = createSignal(false)

  let windowScrollTop = 0
  let timer: number | NodeJS.Timeout | undefined

  const clearTimer = () => clearTimeout(timer as NodeJS.Timeout | number | undefined)
  const toggleFixed = () => setFixed(!fixed())

  onCleanup(() => {
    clearTimer()
  })

  createEffect(() => {
    if (isServer) return
    const mainContent = document.querySelector<HTMLDivElement>('.main-content')

    if (fixed() || modal() !== null) {
      console.debug('scroll to top in Header: fixed and modal not null')
      windowScrollTop = window?.scrollY || 0
      if (mainContent) mainContent.style.marginTop = `-${windowScrollTop}px`
    }

    document.body.classList.toggle('fixed', fixed() || modal() !== null)
    document.body.classList.toggle(styles.fixed, fixed() && !modal())

    if (!(fixed() || modal())) {
      console.debug('scroll to top in Header: not fixed and not modal')
      window?.scrollTo(0, windowScrollTop)
      if (mainContent) mainContent.style.marginTop = ''
    }
  })

  onMount(() => {
    let scrollTop = window.scrollY

    const handleScroll = () => {
      setIsScrollingBottom(window.scrollY > scrollTop)
      setIsScrolled(window.scrollY > 0)
      scrollTop = window.scrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    onCleanup(() => {
      window.removeEventListener('scroll', handleScroll)
    })
  })

  const [activeSubmenu, setActiveSubmenu] = createSignal<string | null>(null)
  let hideTimer: number | undefined

  const switchView = (show: boolean, submenu: string) => {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = undefined
    }
    setActiveSubmenu(show ? submenu : null)
  }

  const hideSubnavigation = (_ev?: MouseEvent) => {
    // Добавляем задержку перед скрытием подменю
    hideTimer = window.setTimeout(() => {
      setActiveSubmenu(null)
    }, 200) // 200ms задержка
  }

  const { showModal } = useUI()
  const handleCreatePostClick = (event: Event) => {
    event.preventDefault()
    if (!session()?.token) {
      setFixed(false)
      showModal('auth')
      return
    }

    redirect('/edit/new')
  }

  //the comments section is scrolled to when the comments icon is clicked
  const handleCommentClick = () => {
    // Always ensure scroll to comments happens
    const commentsSection = document.querySelector('#comments')
    if (commentsSection) {
      commentsSection.scrollIntoView({ behavior: 'smooth' })
    }
    // Update search params to maintain the URL state
    changeSearchParams({ commentId: 0 })
  }
  return (
    <header
      class={styles.mainHeader}
      classList={{
        [styles.headerFixed]: props.isHeaderFixed,
        [styles.headerScrolledTop]: !getIsScrollingBottom() && getIsScrolled(),
        [styles.headerScrolledBottom]:
          (getIsScrollingBottom() && getIsScrolled() && !isProfilePopupVisible()) || isSharePopupVisible(),
        [styles.headerWithTitle]: Boolean(props.title)
      }}
    >
      <Modal
        variant={searchParams?.source ? 'narrow' : 'wide'}
        name="auth"
        hideClose={searchParams?.source === 'authguard'}
        noPadding={true}
      >
        <AuthModal />
      </Modal>

      <Modal variant="narrow" name="confirm">
        <ConfirmModal />
      </Modal>

      <Modal variant="wide" name="search">
        <SearchModal />
      </Modal>

      <Modal variant="wide" name="feedback">
        <Feedback />
      </Modal>

      {/* EmbedChoiceModal удален - legacy код, не использовался */}

      <div class={clsx(styles.mainHeaderInner)}>
        <div class="wide-container">
          <nav class={clsx('row', styles.headerInner, { [styles.fixed]: fixed() })} aria-label="Основная навигация">
            <div class={clsx(styles.burgerContainer, 'col-auto')}>
              <button
                class={clsx(styles.burger, { [styles.fixed]: fixed() })}
                onClick={toggleFixed}
                aria-label={fixed() ? 'Закрыть меню' : 'Открыть меню'}
                aria-expanded={fixed()}
                aria-controls="main-navigation"
                type="button"
              >
                <div />
              </button>
            </div>
            <div class={clsx('col-auto', styles.mainLogo)}>
              <A href="/" aria-label="Перейти на главную страницу Discours">
                <img src="/logo.svg" alt={t('Discours')} />
              </A>
            </div>
            <div class={clsx('col', styles.mainNavigationWrapper)}>
              <Show when={props.title}>
                <div class={styles.articleHeader}>{props.title}</div>
              </Show>
              <div class={clsx(styles.mainNavigation, { [styles.fixed]: fixed() })} id="main-navigation">
                <ul class={styles.headerNavLinks} aria-label="Основная навигация">
                  <For each={['journal', 'feed', 'topics', 'authors', 'guide']}>
                    {(route) => {
                      const isActive = () => {
                        const currentPath = loc.pathname.split('/')[1] || ''
                        return route === 'journal' ? !currentPath : currentPath === route
                      }

                      return (
                        <li
                          class={clsx({ [styles.active]: isActive() })}
                          onMouseOver={() => {
                            if (!isActive() && route !== 'authors') {
                              switchView(true, route)
                            }
                          }}
                          onMouseOut={hideSubnavigation}
                        >
                          <A
                            href={route === 'journal' ? '/' : `/${route}`}
                            aria-current={isActive() ? 'page' : undefined}
                          >
                            {t(capitalize(route))}
                          </A>
                        </li>
                      )
                    }}
                  </For>
                </ul>

                <div class={styles.mainNavigationMobile}>
                  <h4>{t('Participating')}</h4>
                  <ul class={stylesFeedSwitcher.feedSwitcher}>
                    <li>
                      <button onClick={handleCreatePostClick} aria-label="Создать новую публикацию" type="button">
                        {t('Create post')}
                      </button>
                    </li>
                    <li>
                      <A href="/connect">{t('Suggest an idea')}</A>
                    </li>
                    <li>
                      <A href="/support">{t('Support the project')}</A>
                    </li>
                  </ul>

                  <h4>{t('Subscribe us')}</h4>
                  <ul class={stylesFeedSwitcher.feedSwitcher} aria-label="Социальные сети">
                    <li class={styles.mainNavigationSocial}>
                      <a
                        href="https://www.instagram.com/discoursio/"
                        aria-label="Подписаться на Instagram Discours"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="user-link-instagram" class={styles.icon} aria-hidden="true" />
                        Instagram
                      </a>
                    </li>
                    <li class={styles.mainNavigationSocial}>
                      <a
                        href="https://facebook.com/discoursio"
                        aria-label="Подписаться на Facebook Discours"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="user-link-facebook" class={styles.icon} aria-hidden="true" />
                        Facebook
                      </a>
                    </li>
                    <li class={styles.mainNavigationSocial}>
                      <a
                        href="https://twitter.com/discours_io"
                        aria-label="Подписаться на Twitter Discours"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="user-link-twitter" class={styles.icon} aria-hidden="true" />
                        Twitter
                      </a>
                    </li>
                    <li class={styles.mainNavigationSocial}>
                      <a
                        href="https://t.me/discoursio"
                        aria-label="Подписаться на Telegram Discours"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="user-link-telegram" class={styles.icon} aria-hidden="true" />
                        Telegram
                      </a>
                    </li>
                    <li class={styles.mainNavigationSocial}>
                      <a
                        href="https://dzen.ru/discoursio"
                        aria-label="Подписаться на Дзен Discours"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="user-link-dzen" class={styles.icon} aria-hidden="true" />
                        Dzen
                      </a>
                    </li>
                    <li class={styles.mainNavigationSocial}>
                      <a
                        href="https://vk.com/discoursio"
                        aria-label="Подписаться на VK Discours"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="user-link-vk" class={styles.icon} aria-hidden="true" />
                        VK
                      </a>
                    </li>
                  </ul>

                  <h4>{t('Newsletter')}</h4>
                  <Newsletter variant={'mobileSubscription'} />

                  <h4>{t('Language')}</h4>
                  <label for="language-selector-mobile" class="sr-only">
                    {t('Select language')}
                  </label>
                  <select
                    id="language-selector-mobile"
                    class={styles.languageSelectorMobile}
                    onChange={handleSwitchLanguage}
                    value={lang()}
                    aria-label="Выбор языка"
                  >
                    <option value="ru">🇷🇺 Русский</option>
                    <option value="en">🇬🇧 English</option>
                  </select>

                  <nav class={styles.mainNavigationAdditionalLinks} aria-label="Дополнительные ссылки">
                    <A href="/dogma">{t('Dogma')}</A>
                    <A href="/terms">{t('Discussion rules')}</A>
                    <A href="/principles">{t('Principles')}</A>
                  </nav>

                  <p
                    class={styles.mobileDescription}
                    innerHTML={t(
                      'Independant magazine with an open horizontal cooperation about culture, science and society'
                    )}
                  />
                  <div class={styles.mobileCopyright}>
                    {t('Discours')} &copy; 2015&ndash;{new Date().getFullYear()}{' '}
                  </div>
                </div>
              </div>
            </div>

            <div class={clsx('col-auto', styles.createPostLink)}>
              <A href="/edit/new">
                <span class={styles.createPostLinkLabel}>{t('Create post')}</span>
                <Icon name="pencil-outline" class={styles.icon} />
              </A>
            </div>

            <div class={clsx('col-auto')}>
              <HeaderControls showInboxButton={false} setIsProfilePopupVisible={setIsProfilePopupVisible} />
            </div>

            <Show when={props.title}>
              <div
                class={clsx(styles.articleControls, 'col-auto', {
                  [styles.articleControlsAuthorized]: session()?.author?.id
                })}
              >
                <SharePopup
                  title={props.title || ''}
                  imageUrl={props.cover || ''}
                  shareUrl={getShareUrl()}
                  description={props.desc || ''}
                  onVisibilityChange={setIsSharePopupVisible}
                  containerCssClass={styles.control}
                  trigger={
                    <>
                      <Icon name="share-outline" class={styles.icon} aria-hidden="true" />
                      <Icon name="share-outline-hover" class={clsx(styles.icon, styles.iconHover)} aria-hidden="true" />
                    </>
                  }
                />
                <button
                  onClick={handleCommentClick}
                  class={styles.control}
                  aria-label="Перейти к комментариям"
                  type="button"
                >
                  <Icon name="comment" class={styles.icon} aria-hidden="true" />
                  <Icon name="comment-hover" class={clsx(styles.icon, styles.iconHover)} aria-hidden="true" />
                </button>
                <button
                  class={styles.control}
                  onClick={handleCreatePostClick}
                  aria-label="Создать новую публикацию"
                  type="button"
                >
                  <Icon name="pencil-outline" class={styles.icon} aria-hidden="true" />
                  <Icon name="pencil-outline-hover" class={clsx(styles.icon, styles.iconHover)} aria-hidden="true" />
                </button>
                <A class={styles.control} href="/feed/bookmarked" aria-label="Перейти к закладкам">
                  <Icon name="bookmark" class={styles.icon} aria-hidden="true" />
                  <Icon name="bookmark-hover" class={clsx(styles.icon, styles.iconHover)} aria-hidden="true" />
                </A>
              </div>
            </Show>

            <nav
              class={clsx(styles.subnavigation)}
              classList={{ hidden: activeSubmenu() !== 'guide' }}
              onMouseEnter={() => switchView(true, 'guide')}
              onMouseLeave={hideSubnavigation}
              aria-label="Подменю руководства"
            >
              <div class="wide-container">
                <ul class="nodash">
                  <li>
                    <A href="/manifest">{t('Manifesto')}</A>
                  </li>
                  <li>
                    <A href="/dogma">{t('Dogma')}</A>
                  </li>
                  <li>
                    <A href="/principles">{t('Our principles')}</A>
                  </li>
                  <li>
                    <A href="/guide">{t('Platform Guide')}</A>
                  </li>
                  <li>
                    <A href="/support">{t('Support us')}</A>
                  </li>
                  <li>
                    <A href="/manifest#participation">{t('How to help')}</A>
                  </li>
                  <li class={styles.rightItem}>
                    <A href="/connect">
                      {t('Suggest an idea')}
                      <Icon
                        name="arrow-right-black"
                        class={clsx(styles.icon, styles.rightItemIcon)}
                        aria-hidden="true"
                      />
                    </A>
                  </li>
                </ul>
              </div>
            </nav>

            <div
              class={clsx(styles.subnavigation, styles.subnavigationFeed)}
              classList={{ hidden: activeSubmenu() !== 'topics' }}
              onMouseEnter={() => switchView(true, 'topics')}
              onMouseLeave={hideSubnavigation}
            >
              <TopicsNav inSubnavigation={true} />
            </div>

            <div
              class={clsx(styles.subnavigation, styles.subnavigationFeed)}
              classList={{ hidden: activeSubmenu() !== 'feed' }}
              onMouseEnter={() => switchView(true, 'feed')}
              onMouseLeave={hideSubnavigation}
            >
              <div class="wide-container">
                <ul class="nodash">
                  <li>
                    <A href={'/feed'}>
                      <span class={styles.subnavigationItemName}>
                        <Icon name="feed-all" class={styles.icon} />
                        {t('All')}
                      </span>
                    </A>
                  </li>

                  <li>
                    <A href={'/feed/followed'}>
                      <span class={styles.subnavigationItemName}>
                        <Icon name="feed-my" class={styles.icon} />
                        {t('My feed')}
                      </span>
                    </A>
                  </li>
                  <li>
                    <A href={'/feed/coauthored'}>
                      <span class={styles.subnavigationItemName}>
                        <Icon name="feed-collaborate" class={styles.icon} />
                        {t('Participation')}
                      </span>
                    </A>
                  </li>
                  <li>
                    <A href={'/feed/discussed'}>
                      <span class={styles.subnavigationItemName}>
                        <Icon name="feed-discussion" class={styles.icon} />
                        {t('Discussions')}
                      </span>
                    </A>
                  </li>
                  {/* <li>
                  <A href={'/feed/bookmarked'}>
                    <span class={styles.subnavigationItemName}>
                      <Icon name="bookmark" class={styles.icon} />
                      {t('Bookmarks')}
                    </span>
                  </A>
                </li> */}
                </ul>
              </div>
            </div>
          </nav>
        </div>

        <NoHydration>
          <Show when={!isNotificationsPanelOpen()}>
            <Toaster
              position="bottom-right"
              duration={4000}
              class={styles.toasterContainer}
              toastOptions={{
                class: styles.snackbar,
                style: {
                  background: 'var(--toast-background)',
                  color: 'var(--toast-text-color)',
                  'border-radius': 'var(--toast-border-radius)',
                  'box-shadow': 'var(--toast-box-shadow)',
                  'font-size': 'var(--toast-font-size)'
                }
              }}
            />
          </Show>
        </NoHydration>
      </div>
    </header>
  )
}
