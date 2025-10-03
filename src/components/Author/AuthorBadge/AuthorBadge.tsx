import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { createEffect, createSignal, Match, Show, Suspense, Switch } from 'solid-js'
import { Button } from '~/components/_shared/Button'
import { CheckButton } from '~/components/_shared/CheckButton'
import { ConditionalWrapper } from '~/components/_shared/ConditionalWrapper'
import { FollowingButton } from '~/components/_shared/FollowingButton'
import { Icon } from '~/components/_shared/Icon'
import { useLocalize } from '~/context/localize'
import { useSession } from '~/context/session'
import { Author, FollowingEntity } from '~/graphql/generated/graphql'
import { isCyrillic } from '~/intl/translate'
import { translit } from '~/intl/translit'
import { mediaMatches } from '~/lib/mediaQuery'
import { Userpic } from '../Userpic'
import styles from './AuthorBadge.module.scss'

type Props = {
  author: Author
  minimize?: boolean
  showMessageButton?: boolean
  iconButtons?: boolean
  nameOnly?: boolean
  inviteView?: boolean
  onInvite?: (id: number) => void
  selected?: boolean
  subscriptionsMode?: boolean
  onClick?: () => void
}
export const AuthorBadge = (props: Props) => {
  const navigate = useNavigate()
  const { t, formatDate, lang } = useLocalize()
  const { session, requireAuthentication } = useSession()
  const [isMobileView, setIsMobileView] = createSignal(false)

  createEffect(() => setIsMobileView(!mediaMatches.sm))

  const initChat = () => {
    // eslint-disable-next-line solid/reactivity
    requireAuthentication(() => {
      props.author?.id && navigate(`/inbox/${props.author?.id}`, { replace: true })
    }, 'discussions')
  }

  const getName = (name: string) => {
    if (lang() !== 'ru' && isCyrillic(name || '')) {
      if (props.author.name === 'Дискурс') {
        return 'Discours'
      }

      return translit(name || '')
    }

    return name || ''
  }

  const truncateBio = (bio: string, maxLength = 128): string => {
    // Удаляем HTML теги для подсчета реальной длины текста
    const textOnly = bio.replace(/<[^>]*>/g, '')
    if (textOnly.length <= maxLength) {
      return bio
    }
    // Обрезаем до maxLength символов и добавляем многоточие
    const truncated = textOnly.substring(0, maxLength).trim()
    return `${truncated}...`
  }

  const handleClick = (_e: MouseEvent) => {
    if (props.onClick) {
      props.onClick()
    }
  }

  return (
    <div class={clsx(styles.AuthorBadge, { [styles.nameOnly]: props.nameOnly })} onClick={handleClick}>
      <div class={styles.basicInfo}>
        <Userpic
          hasLink={true}
          size={isMobileView() ? 'M' : 'L'}
          name={getName(props.author.name || '')}
          userpic={props.author.pic || ''}
          slug={props.author.slug}
        />
        <ConditionalWrapper
          condition={!props.inviteView}
          wrapper={(children) => (
            <a href={`/@${props.author.slug}`} class={styles.info}>
              {children}
            </a>
          )}
        >
          <div class={styles.name}>
            <span>{getName(props.author.name || '')}</span>
          </div>
          <Show when={!props.nameOnly}>
            <Switch
              fallback={
                <div class={styles.bio}>
                  {t('member since some time', {
                    date: formatDate(new Date((props.author.created_at || 0) * 1000))
                  })}
                </div>
              }
            >
              <Match when={props.author.bio}>
                <div class={clsx('text-truncate', styles.bio)} innerHTML={truncateBio(props.author.bio || '')} />
              </Match>
            </Switch>
            <Show when={props.author?.stat && !props.subscriptionsMode}>
              <div class={styles.bio}>
                <Suspense>
                  <div
                    class="stats"
                    style="display: flex; flex-wrap: nowrap; gap: 1rem; margin-top: 0.4rem; color: var(--black-400); font-size: 1.2rem; line-height: 1.3; overflow-x: auto;"
                  >
                    {(props.author?.stat?.shouts || 0) > 0 && (
                      <span
                        class="statItem"
                        style="display: inline-flex; align-items: center; white-space: nowrap; gap: 0.3rem; flex-shrink: 0;"
                      >
                        {t('some shouts', { count: props.author.stat?.shouts })}
                      </span>
                    )}
                    {(props.author?.stat?.topics || 0) > 0 && (
                      <span
                        class="statItem"
                        style="display: inline-flex; align-items: center; white-space: nowrap; gap: 0.3rem; flex-shrink: 0;"
                      >
                        {t('some topics', { count: props.author.stat?.topics })}
                      </span>
                    )}
                    {props.author?.stat?.coauthors && props.author.stat.coauthors > 0 && (
                      <span
                        class="statItem"
                        style="display: inline-flex; align-items: center; white-space: nowrap; gap: 0.3rem; flex-shrink: 0;"
                      >
                        <Icon
                          name="feed-collaborate"
                          class="statIcon"
                          style="width: 1.2rem; height: 1.2rem; flex-shrink: 0; color: var(--black-400);"
                        />
                        <span class="statCount" title={t('some coauthors', { count: props.author.stat?.coauthors })}>
                          {props.author.stat?.coauthors}
                        </span>
                      </span>
                    )}
                    {(props.author?.stat?.followers || 0) > 0 && (
                      <span
                        class="statItem"
                        style="display: inline-flex; align-items: center; white-space: nowrap; gap: 0.3rem; flex-shrink: 0;"
                      >
                        {t('some followers', { count: props.author.stat?.followers })}
                      </span>
                    )}
                    {props.author?.stat?.viewed_shouts && props.author.stat.viewed_shouts > 0 && (
                      <span
                        class="statItem"
                        style="display: inline-flex; align-items: center; white-space: nowrap; gap: 0.3rem; flex-shrink: 0;"
                        title={t('some views', { count: props.author.stat?.viewed_shouts })}
                      >
                        <Icon name="view" class="statIcon" style="width: 1.2rem; height: 1.2rem; flex-shrink: 0;" />
                        {props.author.stat?.viewed_shouts}
                      </span>
                    )}
                    {(props.author?.stat?.comments || 0) > 0 && (
                      <span
                        class="statItem"
                        style="display: inline-flex; align-items: center; white-space: nowrap; gap: 0.3rem; flex-shrink: 0;"
                      >
                        <Icon name="comment" class="statIcon" style="width: 1.2rem; height: 1.2rem; flex-shrink: 0;" />
                        <span class="statCount" title={t('some comments', { count: props.author.stat?.comments })}>
                          {props.author.stat?.comments || 0}
                        </span>
                        {' / '}
                        <span class="statCount" title={t('some replies', { count: props.author.stat?.replies_count })}>
                          {props.author.stat?.replies_count || 0}
                        </span>
                      </span>
                    )}
                    {props.author?.stat &&
                      ((props.author.stat?.rating_shouts && props.author.stat.rating_shouts !== 0) ||
                        (props.author.stat?.rating_comments && props.author.stat.rating_comments !== 0)) && (
                        <span
                          class="statItem"
                          style="display: inline-flex; align-items: center; white-space: nowrap; gap: 0.3rem; flex-shrink: 0;"
                        >
                          <span class="statCount">
                            <span title={t('Rating shouts')}>
                              {(props.author.stat?.rating_shouts || 0) > 0 ? '+' : ''}
                              {props.author.stat?.rating_shouts || 0}
                            </span>
                            {' / '}
                            <span title={t('Rating comments')}>
                              {(props.author.stat?.rating_comments || 0) > 0 ? '+' : ''}
                              {props.author.stat?.rating_comments || 0}
                            </span>
                          </span>
                        </span>
                      )}
                  </div>
                </Suspense>
              </div>
            </Show>
          </Show>
        </ConditionalWrapper>
      </div>
      <Show when={(props.author.slug !== session()?.author?.slug && !props.nameOnly) || props.minimize}>
        <div class={styles.actions}>
          <Show when={props.author.slug !== session()?.author?.slug}>
            <FollowingButton
              entity={FollowingEntity.Author}
              slug={props.author.slug}
              // 🔄 НЕ передаем isFollowed - пусть компонент сам определяет из контекста
              minimize={props.minimize}
            />
          </Show>
          <Show when={props.showMessageButton}>
            <Button
              variant={props.iconButtons ? 'secondary' : 'bordered'}
              size="S"
              value={t('Message')}
              onClick={initChat}
              class={clsx(styles.actionButton, { [styles.iconed]: props.iconButtons })}
            />
          </Show>
        </div>
      </Show>
      <Show when={props.inviteView}>
        <CheckButton
          text={t('Invite')}
          checked={Boolean(props.selected)}
          onClick={() => props.onInvite?.(props.author.id)}
        />
      </Show>
    </div>
  )
}
