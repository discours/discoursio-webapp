/**
 * Placeholder component displays different placeholder content based on type and mode.
 *
 * @param {PlaceholderProps} props - The properties for the component.
 * @returns {JSX.Element | null} The rendered placeholder or null if data is missing.
 */

import { A } from '@solidjs/router'
import { clsx } from 'clsx'
import { createMemo, For, Show } from 'solid-js'
import placeholderDiscussionsImg from '~/assets/images/placeholder-discussions.webp'
import placeholderExpertsImg from '~/assets/images/placeholder-experts.webp'
import placeholderFeedImg from '~/assets/images/placeholder-feed.webp'
// Импорт изображений
import placeholderJoinImg from '~/assets/images/placeholder-join.webp'
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
  image: placeholderJoinImg,
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

const DRAFTSSET = {
  image: placeholderJoinImg,
  header: 'No drafts yet',
  text: 'Create your first draft to start writing',
  buttonLabel: 'Create draft',
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
    image: placeholderFeedImg,
    header: 'Create your own feed',
    text: 'Choose your favorite authors and topics to follow',
    buttonLabelAuthor: 'Popular authors',
    buttonLabelFeed: 'Create own feed',
    href: '/author?by=followers'
  },
  coauthored: {
    image: placeholderExpertsImg,
    header: 'Find collaborators',
    text: 'Find co-authors to collaborate on your next project',
    buttonLabel: 'Find co-authors',
    href: '/author?by=name'
  },
  discussed: {
    image: placeholderDiscussionsImg,
    header: 'Participate in discussions',
    text: 'Leave your comment and discuss the article with other readers',
    buttonLabelAuthor: 'Current discussions',
    buttonLabelFeed: 'Enter',
    href: '/feed/hot'
  },
  author: AUTHORSET,
  comments: {
    image: placeholderDiscussionsImg,
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
  drafts: DRAFTSSET
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
        <img src={placeholderData()?.image} alt={placeholderData()?.header} />
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
              {t(placeholderData()?.buttonLabelFeed || placeholderData()?.buttonLabel || 'Sign in')}
            </A>
          }
        >
          <A class={styles.button} href={placeholderData()?.href}>
            {t(placeholderData()?.buttonLabelAuthor || placeholderData()?.buttonLabel || 'Start')}
            <Show when={props.mode === 'profile'}>
              <Icon name="arrow-right-2" class={styles.icon} />
            </Show>
          </A>
        </Show>
      </div>
    </div>
  )
}
