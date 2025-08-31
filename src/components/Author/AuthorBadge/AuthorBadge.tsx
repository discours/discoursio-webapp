import { useNavigate } from '@solidjs/router'
import { clsx } from 'clsx'
import { createEffect, createSignal, Match, Show, Switch } from 'solid-js'
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
                  {t('Registered since some time', {
                    date: formatDate(new Date((props.author.created_at || 0) * 1000))
                  })}
                </div>
              }
            >
              <Match when={props.author.bio}>
                <div class={clsx('text-truncate', styles.bio)} innerHTML={props.author.bio || ''} />
              </Match>
            </Switch>
            <Show when={props.author?.stat && !props.subscriptionsMode}>
              <div class={styles.bio}>
                <Show when={(props.author?.stat?.shouts || 0) > 0}>
                  <div>{t('some posts', { count: props.author.stat?.shouts ?? 0 })}</div>
                </Show>
                <Show when={(props.author?.stat?.comments || 0) > 0}>
                  <div>{t('some comments', { count: props.author.stat?.comments ?? 0 })}</div>
                </Show>
                <Show when={(props.author?.stat?.followers || 0) > 0}>
                  <div>{t('some followers', { count: props.author.stat?.followers ?? 0 })}</div>
                </Show>
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
              value={props.iconButtons ? <Icon name="inbox-white" /> : t('Message')}
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
