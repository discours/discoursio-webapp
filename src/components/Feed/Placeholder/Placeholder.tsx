/**
 * Placeholder component displays different placeholder content based on type and mode.
 *
 * @param {PlaceholderProps} props - The properties for the component.
 * @returns {JSX.Element | null} The rendered placeholder or null if data is missing.
 */

import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { For, Show, createMemo } from 'solid-js'

import { Icon } from '~/components/_shared/Icon'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'

import styles from './Placeholder.module.scss'

type ProfileLink = {
  href: string
  label: string
}

type PlaceholderData = {
  [key: string]: {
    image: string
    header: string
    text: string
    buttonLabel?: string
    buttonLabelAuthor?: string
    buttonLabelFeed?: string
    href: string
    profileLinks?: ProfileLink[]
  }
}

export type PlaceholderProps = {
  type: keyof PlaceholderData // "followed" | "coauthored" | "discussed" | "author" | "feed" | "comments" | "drafts"
  mode: 'feed' | 'profile'
}

const AUTHORSET = {
  image: 'placeholder-join.webp',
  header: 'Become an author',
  text: 'Join our team of authors to start writing',
  buttonLabel: 'Create post',
  href: '/edit/new',
  profileLinks: [
    {
      href: '/how-to-write-a-good-article',
      label: 'How to write a good article'
    }
  ]
}

const data: PlaceholderData = {
  followed: {
    image: 'placeholder-feed.webp',
    header: 'Create your own feed',
    text: 'Choose your favorite authors and topics to follow',
    buttonLabelAuthor: 'Popular authors',
    buttonLabelFeed: 'Create own feed',
    href: '/author?by=followers'
  },
  coauthored: {
    image: 'placeholder-experts.webp',
    header: 'Find collaborators',
    text: 'Find co-authors to collaborate on your next project',
    buttonLabel: 'Find co-authors',
    href: '/author?by=name'
  },
  discussed: {
    image: 'placeholder-discussions.webp',
    header: 'Participate in discussions',
    text: 'Leave your comment and discuss the article with other readers',
    buttonLabelAuthor: 'Current discussions',
    buttonLabelFeed: 'Enter',
    href: '/feed/hot'
  },
  author: AUTHORSET,
  comments: {
    image: 'placeholder-discussions.webp',
    header: 'Join discussions',
    text: 'Leave your comment and discuss the article with other readers',
    buttonLabel: 'Go to discussions',
    href: '/feed/hot',
    profileLinks: [
      {
        href: '/debate',
        label: 'Discussion rules'
      },
      {
        href: '/debate#ban',
        label: 'Block rules'
      }
    ]
  },
  drafts: AUTHORSET
}

export const Placeholder = (props: PlaceholderProps) => {
  const { t } = useLocalize()
  const { session } = useSession()

  const placeholderData = createMemo(() => {
    const dataForType = data[props.type]
    if (!dataForType) {
      console.warn(`No placeholder data found for type: ${props.type}`)
    }
    return dataForType
  })

  if (!placeholderData()) {
    return null
  }

  return (
    <div
      class={clsx(
        styles.placeholder,
        styles[`placeholder--${props.type}` as keyof typeof styles],
        styles[`placeholder--${props.mode}-mode` as keyof typeof styles]
      )}
    >
      <div class={styles.placeholderCover}>
        <img src={`/${placeholderData()?.image}`} alt={placeholderData()?.header} />
      </div>
      <div class={styles.placeholderContent}>
        <div>
          <h3 innerHTML={t(placeholderData()?.header)} />
          <p innerHTML={t(placeholderData()?.text)} />
        </div>

        <Show when={placeholderData()?.profileLinks}>
          <div class={styles.bottomLinks}>
            <For each={placeholderData()?.profileLinks}>
              {(link) => (
                <A href={link.href}>
                  <Icon name="link-white" class={styles.icon} />
                  {t(link.label)}
                </A>
              )}
            </For>
          </div>
        </Show>

        <Show
          when={session()?.token}
          fallback={
            <A class={styles.button} href="?m=auth&mode=login">
              {t(
                session()?.token
                  ? placeholderData()?.buttonLabelAuthor || ''
                  : placeholderData()?.buttonLabelFeed || ''
              )}
            </A>
          }
        >
          <A class={styles.button} href={placeholderData()?.href}>
            {t(
              session()?.token
                ? placeholderData()?.buttonLabelAuthor || ''
                : placeholderData()?.buttonLabelFeed || ''
            )}
            <Show when={props.mode === 'profile'}>
              <Icon name="arrow-right-2" class={styles.icon} />
            </Show>
          </A>
        </Show>
      </div>
    </div>
  )
}
