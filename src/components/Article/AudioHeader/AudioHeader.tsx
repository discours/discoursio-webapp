import { Show } from 'solid-js'

import { MediaItem, Topic } from '~/graphql/generated/graphql'
import { CardTopic } from '../../Feed/CardTopic'

import styles from './AudioHeader.module.scss'

type Props = {
  title: string
  cover?: string
  artistData?: MediaItem
  topic: Topic
}

export const AudioHeader = (props: Props) => {
  return (
    <div class={styles.AudioHeader}>
      <div class={styles.albumInfo}>
        <Show when={props.topic}>
          <CardTopic title={props.topic.title || ''} slug={props.topic.slug} />
        </Show>
        <h1>{props.title}</h1>
        <Show when={props.artistData}>
          <div class={styles.artistData}>
            <Show when={props.artistData?.artist}>
              <div class={styles.item}>{props.artistData?.artist || ''}</div>
            </Show>
            <Show when={props.artistData?.date}>
              <div class={styles.item}>{props.artistData?.date || ''}</div>
            </Show>
            <Show when={props.artistData?.genre}>
              <div class={styles.item}>{props.artistData?.genre || ''}</div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  )
}
