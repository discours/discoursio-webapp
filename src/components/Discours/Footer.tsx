import { clsx } from 'clsx'
import { For, createSignal, onMount } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { Icon } from '../_shared/Icon'
import { Newsletter } from '../_shared/Newsletter'
import styles from './Footer.module.scss'

const social = [
  { name: 'facebook', href: 'https://facebook.com/discoursio' },
  { name: 'vk', href: 'https://vk.com/discoursio' },
  { name: 'twitter', href: 'https://twitter.com/discours_io' },
  { name: 'telegram', href: 'https://t.me/discoursio' }
]
type FooterItem = {
  title: string
  slug: string
  rel?: string
}
export const FooterView = () => {
  const { t, lang } = useLocalize()
  const [footerLinks, setFooterLinks] = createSignal<Array<{ header: string; items: FooterItem[] }>>([])

  onMount(() => {
    setFooterLinks([
      {
        header: t('About the project'),
        items: [
          { title: t('Discours Manifest'), slug: '/manifest' },
          { title: t('How it works'), slug: '/guide' },
          { title: t('Dogma'), slug: '/dogma' },
          { title: t('Our principles'), slug: '/principles' },
          { title: t('How to write an article'), slug: '/how-to-write-a-good-article' }
        ]
      },
      {
        header: t('Participating'),
        items: [
          { title: t('Suggest an idea'), slug: '/connect' },
          { title: t('Become an author'), slug: '/edit/new' },
          { title: t('Support Discours'), slug: '/support' },
          {
            title: t('Cooperate with Discours'),
            slug: 'https://docs.google.com/forms/d/e/1FAIpQLSeNNvIzKlXElJtkPkYiXl-jQjlvsL9u4-kpnoRjz1O8Wo40xQ/viewform'
          }
        ]
      },
      {
        header: t('Sections'),
        items: [
          { title: t('Authors'), slug: '/authors' },
          { title: t('Communities'), slug: '/community' },
          { title: t('Partners'), slug: '/partners' },
          { title: t('Special projects'), slug: '/projects' },
          {
            title: lang() === 'ru' ? 'English' : 'Русский',
            slug: `?lng=${lang() === 'ru' ? 'en' : 'ru'}`,
            rel: 'external'
          }
        ]
      }
    ])
  })

  return (
    <footer class={styles.discoursFooter}>
      <div class={clsx(styles.wrapper, 'wide-container')}>
        <div class="row">
          <For each={footerLinks()}>
            {({ header, items }) => (
              <div class="col-sm-8 col-md-6">
                <h5>{t(header)}</h5>
                <ul>
                  <For each={items}>
                    {({ slug, title, rel }: FooterItem) => (
                      <li>
                        {' '}
                        <a href={slug} rel={rel}>
                          {rel ? title : t(title)}
                        </a>{' '}
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            )}
          </For>
          <div class="col-md-6">
            <h5>{t('Subscription')}</h5>
            <p>{t('Join our maillist')}</p>
            <Newsletter />
          </div>
        </div>

        <div class={clsx(styles.footerCopyright, 'row')}>
          <div class="col-md-18 col-lg-20">
            {t(
              'Independant magazine with an open horizontal cooperation about culture, science and society'
            )}
            . {t('Discours')} &copy; 2015&ndash;{new Date().getFullYear()}{' '}
            <a href="/terms">{t('Terms of use')}</a>
          </div>
          <div class={clsx(styles.footerCopyrightSocial, 'col-md-6 col-lg-4')}>
            <For each={social}>
              {(provider) => (
                <div
                  class={clsx(
                    styles.socialItem,
                    styles[`socialItem${provider.name}` as keyof typeof styles]
                  )}
                >
                  <a href={provider.href}>
                    <Icon name={`${provider.name}-white`} class={styles.icon} />
                  </a>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </footer>
  )
}
