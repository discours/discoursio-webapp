import { A, redirect, useLocation, useSearchParams } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { isServer } from 'solid-js/web'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { useUI } from '~/context/ui'
import { capitalize } from '~/utils/capitalize'
import { SharePopup, getShareUrl } from '../Article/SharePopup'
import { AuthModal } from '../AuthModal'
import { SearchModal } from '../SearchModal/SearchModal'
import { Snackbar } from '../Snackbar/Snackbar'
import { ConfirmModal } from '../_shared/ConfirmModal'
import { Icon } from '../_shared/Icon'
import { Modal } from '../_shared/Modal'
import { Newsletter } from '../_shared/Newsletter'
import { HeaderAuth } from './HeaderAuth'
import { TopicsNav } from './TopicsNav'

import stylesFeedSwitcher from '../Feed/FeedSwitcher/FeedSwitcher.module.scss'
import styles from './Header.module.scss'

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
  const [searchParams, changeSearchParams] = useSearchParams<HeaderSearchParams>()
  const [getIsScrollingBottom, setIsScrollingBottom] = createSignal(false)
  const [getIsScrolled, setIsScrolled] = createSignal(false)
  const [fixed, setFixed] = createSignal(false)
  const [isSharePopupVisible, setIsSharePopupVisible] = createSignal(false)
  const [isProfilePopupVisible, setIsProfilePopupVisible] = createSignal(false)

  let windowScrollTop = 0
  let timer: undefined | number | NodeJS.Timeout

  const clearTimer = () => clearTimeout(timer as undefined | number | NodeJS.Timeout)
  const toggleFixed = () => setFixed(!fixed())

  onCleanup(() => {
    clearTimer()
  })

  createEffect(() => {
    if (isServer) return
    const mainContent = document.querySelector<HTMLDivElement>('.main-content')

    if (fixed() || modal() !== null) {
      windowScrollTop = window?.scrollY || 0
      if (mainContent) mainContent.style.marginTop = `-${windowScrollTop}px`
    }

    document.body.classList.toggle('fixed', fixed() || modal() !== null)
    document.body.classList.toggle(styles.fixed, fixed() && !modal())

    if (!(fixed() || modal())) {
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
    if (!session()?.access_token) {
      setFixed(false)
      showModal('auth')
      return
    }

    redirect('/edit/new')
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

      <div class={clsx(styles.mainHeaderInner, 'wide-container')}>
        <nav class={clsx('row', styles.headerInner, { [styles.fixed]: fixed() })}>
          <div class={clsx(styles.burgerContainer, 'col-auto')}>
            <div class={clsx(styles.burger, { [styles.fixed]: fixed() })} onClick={toggleFixed}>
              <div />
            </div>
          </div>
          <div class={clsx('col-md-5 col-xl-4 col-auto', styles.mainLogo)}>
            <A href="/">
              <img src="/logo.svg" alt={t('Discours')} />
            </A>
          </div>
          <div class={clsx('col col-md-13 col-lg-12 offset-xl-1', styles.mainNavigationWrapper)}>
            <Show when={props.title}>
              <div class={styles.articleHeader}>{props.title}</div>
            </Show>
            <div class={clsx(styles.mainNavigation, { [styles.fixed]: fixed() })}>
              <ul class={styles.headerNavLinks}>
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
                        <A href={route === 'journal' ? '/' : `/${route}`}>{t(capitalize(route))}</A>
                      </li>
                    )
                  }}
                </For>
              </ul>

              <div class={styles.mainNavigationMobile}>
                <h4>{t('Participating')}</h4>
                <ul class={stylesFeedSwitcher.feedSwitcher}>
                  <li>
                    <button onClick={handleCreatePostClick}>{t('Create post')}</button>
                  </li>
                  <li>
                    <A href="/connect">{t('Suggest an idea')}</A>
                  </li>
                  <li>
                    <A href="/support">{t('Support the project')}</A>
                  </li>
                </ul>

                <h4>{t('Subscribe us')}</h4>
                <ul class={stylesFeedSwitcher.feedSwitcher}>
                  <li class={styles.mainNavigationSocial}>
                    <a href="https://www.instagram.com/discoursio/">
                      <Icon name="user-link-instagram" class={styles.icon} />
                      Instagram
                    </a>
                  </li>
                  <li class={styles.mainNavigationSocial}>
                    <a href="https://facebook.com/discoursio">
                      <Icon name="user-link-facebook" class={styles.icon} />
                      Facebook
                    </a>
                  </li>
                  <li class={styles.mainNavigationSocial}>
                    <a href="https://twitter.com/discours_io">
                      <Icon name="user-link-twitter" class={styles.icon} />
                      Twitter
                    </a>
                  </li>
                  <li class={styles.mainNavigationSocial}>
                    <a href="https://t.me/discoursio">
                      <Icon name="user-link-telegram" class={styles.icon} />
                      Telegram
                    </a>
                  </li>
                  <li class={styles.mainNavigationSocial}>
                    <a href="https://dzen.ru/discoursio">
                      <Icon name="user-link-dzen" class={styles.icon} />
                      Dzen
                    </a>
                  </li>
                  <li class={styles.mainNavigationSocial}>
                    <a href="https://vk.com/discoursio">
                      <Icon name="user-link-vk" class={styles.icon} />
                      VK
                    </a>
                  </li>
                </ul>

                <h4>{t('Newsletter')}</h4>
                <Newsletter variant={'mobileSubscription'} />

                <h4>{t('Language')}</h4>
                <select
                  class={styles.languageSelectorMobile}
                  onChange={handleSwitchLanguage}
                  value={lang()}
                >
                  <option value="ru">🇷🇺 Русский</option>
                  <option value="en">🇬🇧 English</option>
                </select>

                <div class={styles.mainNavigationAdditionalLinks}>
                  <A href="/dogma">{t('Dogma')}</A>
                  <A href="/terms">{t('Discussion rules')}</A>
                  <A href="/principles">{t('Principles')}</A>
                </div>

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
          <HeaderAuth showInboxButton={false} setIsProfilePopupVisible={setIsProfilePopupVisible} />
          <Show when={props.title}>
            <div
              class={clsx(styles.articleControls, 'col-auto', {
                [styles.articleControlsAuthorized]: session()?.user?.id
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
                    <Icon name="share-outline" class={styles.icon} />
                    <Icon name="share-outline-hover" class={clsx(styles.icon, styles.iconHover)} />
                  </>
                }
              />
              <div onClick={() => changeSearchParams({ commentId: 0 })} class={styles.control}>
                <Icon name="comment" class={styles.icon} />
                <Icon name="comment-hover" class={clsx(styles.icon, styles.iconHover)} />
              </div>
              <button class={styles.control} onClick={handleCreatePostClick}>
                <Icon name="pencil-outline" class={styles.icon} />
                <Icon name="pencil-outline-hover" class={clsx(styles.icon, styles.iconHover)} />
              </button>
              <A class={styles.control} href="/feed/bookmarked">
                <Icon name="bookmark" class={styles.icon} />
                <Icon name="bookmark-hover" class={clsx(styles.icon, styles.iconHover)} />
              </A>
            </div>
          </Show>

          <div
            class={clsx(styles.subnavigation, 'col')}
            classList={{ hidden: activeSubmenu() !== 'guide' }}
            onMouseEnter={() => switchView(true, 'guide')}
            onMouseLeave={hideSubnavigation}
          >
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
                  <Icon name="arrow-right-black" class={clsx(styles.icon, styles.rightItemIcon)} />
                </A>
              </li>
            </ul>
          </div>

          <div
            class={clsx(styles.subnavigation, styles.subnavigationFeed, 'col')}
            classList={{ hidden: activeSubmenu() !== 'topics' }}
            onMouseEnter={() => switchView(true, 'topics')}
            onMouseLeave={hideSubnavigation}
          >
            <TopicsNav />
          </div>

          <div
            class={clsx(styles.subnavigation, styles.subnavigationFeed, 'col')}
            classList={{ hidden: activeSubmenu() !== 'feed' }}
            onMouseEnter={() => switchView(true, 'feed')}
            onMouseLeave={hideSubnavigation}
          >
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
        </nav>

        <Snackbar />
      </div>
    </header>
  )
}
