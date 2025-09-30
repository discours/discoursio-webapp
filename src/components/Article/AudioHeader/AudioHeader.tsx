import { clsx } from 'clsx'
import { createSignal, Show } from 'solid-js'

import { Icon } from '~/components/_shared/Icon'
import { Image } from '~/components/_shared/Image'
import { MediaItem, Topic } from '~/graphql/generated/graphql'
import { getCdnUrl } from '~/lib/imageCache' // NOTE: используется для генерации srcSet
import { CardTopic } from '../../Feed/CardTopic'

import styles from './AudioHeader.module.scss'

type Props = {
  title: string
  cover?: string
  artistData?: MediaItem
  topic: Topic
}

export const AudioHeader = (props: Props) => {
  const [expandedImage, setExpandedImage] = createSignal(false)

  // NOTE: srcSet генерация перенесена в getImageSrcSet из imageCache
  // Оставляем для обратной совместимости, но Image компонент сам применит трансформацию

  return (
    <div class={clsx(styles.AudioHeader, { [styles.expandedImage]: expandedImage() })}>
      <div class={styles.cover}>
        <Image
          class={styles.image}
          src={getCdnUrl(props.cover || '')}
          srcSet={generateSrcSet(props.cover || '')}
          alt={props.title}
          width={300}
        />
        <Show when={props.cover}>
          <button type="button" class={styles.expand} onClick={() => setExpandedImage(!expandedImage())}>
            <Icon name="expand-circle" />
          </button>
        </Show>
      </div>
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
