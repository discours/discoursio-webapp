import { clsx } from 'clsx'
import { createEffect, createSignal, Match, Show, Switch } from 'solid-js'

import { useLocalize } from '~/context/localize'
import { Button } from '../Button'
import { Icon } from '../Icon'
import { Popover } from '../Popover'

import styles from './VideoPlayer.module.scss'

type Props = {
  videoUrl: string
  title?: string
  description?: string
  class?: string
  onVideoDelete?: () => void
  articleView?: boolean
}
const watchPattern = /watch=(\w+)/
const ytPattern = /youtu.be\/(\w+)/
const vimeoPattern = /vimeo.com\/(\d+)/

export const VideoPlayer = (props: Props) => {
  const { t } = useLocalize()
  const [videoId, setVideoId] = createSignal<string | undefined>()
  const [isVimeo, setIsVimeo] = createSignal(false)

  createEffect(() => {
    const isYoutube = props.videoUrl.includes('youtube.com') || props.videoUrl.includes('youtu.be')
    setIsVimeo(!isYoutube)
    if (isYoutube) {
      if (props.videoUrl.includes('youtube.com')) {
        const videoIdMatch = props.videoUrl.match(watchPattern)
        setVideoId(videoIdMatch?.[1])
      } else {
        const videoIdMatch = props.videoUrl.match(ytPattern)
        setVideoId(videoIdMatch?.[1])
      }
    } else {
      const videoIdMatch = props.videoUrl.match(vimeoPattern)
      setVideoId(videoIdMatch?.[1])
    }
  })

  return (
    <div class={clsx(styles.VideoPlayer, props.class, { [styles.articleView]: props.articleView })}>
      <Show when={props.onVideoDelete}>
        <Popover content={t('Delete')}>
          {(triggerRef: (el: HTMLElement) => void) => (
            <Button
              ref={triggerRef}
              size="S"
              class={styles.deleteAction}
              onClick={() => props.onVideoDelete?.()}
              value={<Icon class={styles.deleteIcon} name="delete" />}
            />
          )}
        </Popover>
      </Show>
      <Switch>
        <Match when={isVimeo()}>
          <div class={styles.videoContainer}>
            <iframe
              title={props.title}
              src={`https://player.vimeo.com/video/${videoId()}`}
              width="640"
              height="360"
              allow="autoplay; fullscreen; picture-in-picture"
              allowfullscreen
            />
          </div>
        </Match>
        <Match when={!isVimeo()}>
          <div class={styles.videoContainer}>
            <iframe
              title={props.title}
              width="560"
              height="315"
              src={`https://www.youtube.com/embed/${videoId()}`}
              allowfullscreen
            />
          </div>
        </Match>
      </Switch>
    </div>
  )
}
