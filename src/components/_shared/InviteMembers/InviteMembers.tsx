import { createInfiniteScroll } from '@solid-primitives/pagination'
import { clsx } from 'clsx'
import { createSignal, For, onMount, Show } from 'solid-js'

import { useAuthors } from '~/context/authors'
import { useInbox } from '~/context/inbox'
import { useLocalize } from '~/context/localize'
import { useUI } from '~/context/ui'
import { Author } from '~/graphql/schema/core.gen'
import { AuthorBadge } from '../../Author/AuthorBadge'
import { Button } from '../Button'
import { DropdownSelect } from '../DropdownSelect'
import { InlineLoader } from '../InlineLoader'

import styles from './InviteMembers.module.scss'

type InviteAuthor = Author & { selected: boolean }

type Props = {
  title?: string
  variant?: 'coauthors' | 'recipients'
}

const PAGE_SIZE = 10
export const InviteMembers = (props: Props) => {
  const { t } = useLocalize()
  const { hideModal } = useUI()
  const { loadAllAuthors } = useAuthors()
  const { loadChats, createChat } = useInbox()

  const [isLoading, setIsLoading] = createSignal(true)
  const [_authors, setAuthors] = createSignal<Author[]>([])
  const [authorsToInvite, setAuthorsToInvite] = createSignal<InviteAuthor[]>([])
  const [searchResultAuthors, setSearchResultAuthors] = createSignal<Author[]>()
  const [collectionToInvite, setCollectionToInvite] = createSignal<number[]>([])

  // Загружаем авторов при монтировании компонента
  onMount(async () => {
    try {
      setIsLoading(true)
      // Явно вызываем API для загрузки всех авторов
      const allAuthors = await loadAllAuthors()

      // Сохраняем полученных авторов
      setAuthors(allAuthors || [])

      // Подготавливаем авторов для приглашения
      setAuthorsToInvite((allAuthors || []).map((author) => ({ ...author, selected: false })))
    } catch (error) {
      console.error('[InviteMembers] Error loading authors:', error)
    } finally {
      setIsLoading(false)
    }
  })

  const roles = [
    {
      title: t('Editor'),
      description: t('Can write and edit text directly, and accept or reject suggestions from others')
    },
    {
      title: t('Co-author'),
      description: t('Can make any changes, accept or reject suggestions, and share access with others')
    },
    {
      title: t('Commentator'),
      description: t('Can offer edits and comments, but cannot edit the post or share access with others')
    }
  ]

  // Функция получения страницы авторов для бесконечной прокрутки
  const fetcher = async (page: number) => {
    const start = page * PAGE_SIZE
    const end = start + PAGE_SIZE
    const authorsPage = authorsToInvite()?.slice(start, end) || []
    return authorsPage
  }

  const [pages, setEl, { end }] = createInfiniteScroll(fetcher)

  const handleInputChange = async (value: string) => {
    if (value.length > 1) {
      const match = authorsToInvite()?.filter((author) =>
        author.name?.toLowerCase().includes(value.toLowerCase())
      )
      setSearchResultAuthors(match)
    } else {
      setSearchResultAuthors()
    }
  }

  const handleInvite = (id: number) => {
    setCollectionToInvite((prev) => [...prev, id])
  }

  const handleCloseModal = () => {
    setSearchResultAuthors()
    setCollectionToInvite([])
    hideModal()
  }

  const handleCreate = async () => {
    try {
      const result = await createChat(collectionToInvite(), 'chat Title')
      console.debug('[components.Inbox] create chat result:', result)
      hideModal()
      await loadChats()
    } catch (error) {
      console.error('handleCreate chat', error)
    }
  }

  return (
    <>
      <h2>{props.title || t('Invite collaborators')}</h2>
      <div class={clsx(styles.InviteMembers)}>
        <div class={styles.searchHeader}>
          <div class={styles.field}>
            <input
              class={styles.input}
              type="text"
              placeholder={t('Write your colleagues name or email')}
              onChange={(e) => {
                if (props.variant === 'recipients') return
                handleInputChange(e.target.value)
              }}
              onInput={(e) => {
                if (props.variant === 'coauthors') return
                handleInputChange(e.target.value)
              }}
            />
            <Show when={props.variant === 'coauthors'}>
              <DropdownSelect selectItems={roles} />
            </Show>
          </div>
          <Show when={props.variant === 'coauthors'}>
            <Button class={styles.searchButton} variant={'bordered'} size={'M'} value={t('Search')} />
          </Show>
        </div>
        <Show when={props.variant === 'coauthors'}>
          <div class={styles.teaser}>
            <h3>{t('Coming soon')}</h3>
            <p>
              {t(
                'We are working on collaborative editing of articles and in the near future you will have an amazing opportunity - to create together with your colleagues'
              )}
            </p>
          </div>
        </Show>
        <Show when={props.variant === 'recipients'}>
          <div class={styles.authors}>
            <Show
              when={isLoading()}
              fallback={
                <>
                  <For each={searchResultAuthors() ?? pages()}>
                    {(author: Author | InviteAuthor) => (
                      <div class={styles.author}>
                        <AuthorBadge
                          author={author}
                          nameOnly={true}
                          inviteView={true}
                          onInvite={(id) => handleInvite(id)}
                        />
                      </div>
                    )}
                  </For>
                  <Show when={!end()}>
                    <div ref={setEl}>
                      <InlineLoader />
                    </div>
                  </Show>
                </>
              }
            >
              <div class={styles.loadingContainer}>
                <InlineLoader />
                <div>{t('Loading authors...')}</div>
              </div>
            </Show>
          </div>
        </Show>
        <div class={styles.actions}>
          <Button variant={'bordered'} size={'M'} value={t('Cancel')} onClick={handleCloseModal} />
          <Button
            variant={'primary'}
            size={'M'}
            disabled={collectionToInvite().length === 0}
            value={t('Start dialog')}
            onClick={handleCreate}
          />
        </div>
      </div>
    </>
  )
}
