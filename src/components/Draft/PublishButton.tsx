import { clsx } from 'clsx'
import { Show, createEffect, createSignal, onCleanup } from 'solid-js'
import { useDrafts } from '~/context/drafts'
import { useLocalize } from '~/context/localize'
import { Button } from '../_shared/Button'
import { Icon } from '../_shared/Icon'
import { Popover } from '../_shared/Popover'

import styles from './Header.module.scss'

type IconedButtonProps = {
  value: string
  icon: string
  action: () => void
}

const MD_WIDTH_BREAKPOINT = 992

export const PublishButton = () => {
  const { publishDraft, currentDraft } = useDrafts()
  const [width, setWidth] = createSignal(0)
  const { t } = useLocalize()

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

  return (
    <div class={clsx(styles.userControlItem, styles.userControlItemVerbose)}>
      <IconedButton
        value={t('Publish')}
        icon="publish"
        action={() => publishDraft(currentDraft()?.id || 0)}
      />
    </div>
  )
}
