import { createSignal, For, lazy, Show } from 'solid-js'
import { isServer } from 'solid-js/web'
import { Icon } from '~/components/_shared/Icon'
import { Popover } from '~/components/_shared/Popover'
import { sanitizeHtml } from '~/components/SimpleRichEditor/lib/sanitize'
import { SimpleRichEditor } from '~/components/SimpleRichEditor/SimpleRichEditor'
import { useLocalize } from '~/context/localize'
import { MediaItem } from '~/graphql/generated/graphql'
import { descFromBody } from '~/utils/meta'
import { getShareUrl, SharePopup } from '../SharePopup'

import styles from './AudioPlayer.module.scss'

const GrowingTextarea = lazy(() => import('~/components/_shared/GrowingTextarea/GrowingTextarea'))

type Props = {
  media: MediaItem[]
  currentTrackIndex: number
  isPlaying: boolean
  onPlayMedia: (trackIndex: number) => void
  articleSlug?: string
  body?: string
  editorMode?: boolean
  onMediaItemFieldChange?: (index: number, field: keyof MediaItem, value: string) => void
  onChangeMediaIndex?: (direction: 'up' | 'down', index: number) => void
}

export const PlayerPlaylist = (props: Props) => {
  const { t } = useLocalize()
  const [activeEditIndex, setActiveEditIndex] = createSignal(-1)

  const toggleDropDown = (index: number) => {
    setActiveEditIndex(activeEditIndex() === index ? -1 : index)
  }
  const handleMediaItemFieldChange = (field: keyof MediaItem, value: string) => {
    props.onMediaItemFieldChange?.(activeEditIndex(), field, value)
  }

  const play = (index: number) => {
    // event?.stopPropagation()
    props.onPlayMedia(index)
    //const mi = props.media[index]
    //gtag('event', 'select_item', {
    //item_list_id: props.articleSlug,
    //item_list_name: getMediaTitle(mi, index),
    //items: props.media.map((it, ix) => getMediaTitle(it, ix)),
    //})
  }
  return (
    <Show when={props.media?.length > 0} fallback={<div class={styles.playlist} />}>
      <ul class={styles.playlist}>
        <For each={props.media}>
          {(mi, index) => (
            <li>
              <div class={styles.playlistItem}>
                <button
                  class={styles.playlistItemPlayButton}
                  onClick={() => play(index())}
                  type="button"
                  aria-label="Play"
                >
                  <Icon name={props.currentTrackIndex === index() && props.isPlaying ? 'pause' : 'play'} />
                </button>
                <div class={styles.playlistItemText}>
                  <Show
                    when={activeEditIndex() === index() && props.editorMode}
                    fallback={
                      <>
                        <div class={styles.title}>{mi.title || index()}</div>
                        <div class={styles.artist}>{mi.artist || ''}</div>
                      </>
                    }
                  >
                    <input
                      type="text"
                      value={mi.title || ''}
                      class={styles.title}
                      placeholder={t('Song title')}
                      onChange={(e) => handleMediaItemFieldChange('title', e.target.value)}
                    />
                    <input
                      type="text"
                      value={mi.artist || ''}
                      class={styles.artist}
                      placeholder={t('Artist')}
                      onChange={(e) => handleMediaItemFieldChange('artist', e.target.value)}
                    />
                  </Show>
                </div>
                <div class={styles.actions}>
                  <Show when={props.editorMode}>
                    <Popover content={t('Move up')}>
                      {(triggerRef: (el: HTMLElement) => void) => (
                        <button
                          type="button"
                          ref={triggerRef}
                          class={styles.action}
                          disabled={index() === 0}
                          onClick={() => props.onChangeMediaIndex?.('up', index())}
                        >
                          <Icon name="up-button" />
                        </button>
                      )}
                    </Popover>
                    <Popover content={t('Move down')}>
                      {(triggerRef: (el: HTMLElement) => void) => (
                        <button
                          type="button"
                          ref={triggerRef}
                          class={styles.action}
                          disabled={index() === props.media.length - 1}
                          onClick={() => props.onChangeMediaIndex?.('down', index())}
                        >
                          <Icon name="up-button" class={styles.moveIconDown} />
                        </button>
                      )}
                    </Popover>
                  </Show>
                  {(mi.lyrics || mi.body) && !props.editorMode && (
                    <Popover content={t('Show lyrics')}>
                      {(triggerRef: (el: HTMLElement) => void) => (
                        <button ref={triggerRef} type="button" onClick={() => toggleDropDown(index())}>
                          <Icon name="list" />
                        </button>
                      )}
                    </Popover>
                  )}
                  <Popover content={props.editorMode ? t('Edit') : t('Share')}>
                    {(triggerRef: (el: HTMLElement) => void) => (
                      <div ref={triggerRef}>
                        <Show
                          when={!props.editorMode}
                          fallback={
                            <button type="button" onClick={() => toggleDropDown(index())}>
                              <Icon name="pencil-stroke" />
                            </button>
                          }
                        >
                          <SharePopup
                            title={mi.title || ''}
                            description={descFromBody(props.body || '')}
                            imageUrl={mi.pic || ''}
                            shareUrl={getShareUrl({ pathname: `/${props.articleSlug}` })}
                            trigger={
                              <div>
                                <Icon name="share-media" />
                              </div>
                            }
                          />
                        </Show>
                      </div>
                    )}
                  </Popover>
                </div>
              </div>
              <Show when={activeEditIndex() === index()}>
                <Show
                  when={props.editorMode}
                  fallback={
                    <div class={styles.descriptionBlock}>
                      <Show when={mi.body}>
                        <div class={styles.description}>
                          {/* ✅ КРИТИЧНО: Санитизация HTML и проверка isServer для гидрации */}
                          <Show when={!isServer} fallback={<div>{mi.body || ''}</div>}>
                            <div innerHTML={sanitizeHtml(mi.body || '')} />
                          </Show>
                        </div>
                      </Show>
                      <Show when={mi.lyrics}>
                        <div class={styles.lyrics}>
                          {/* ✅ КРИТИЧНО: Санитизация HTML и проверка isServer для гидрации */}
                          <Show when={!isServer} fallback={<div>{mi.lyrics || ''}</div>}>
                            <div innerHTML={sanitizeHtml(mi.lyrics || '')} />
                          </Show>
                        </div>
                      </Show>
                    </div>
                  }
                >
                  <div class={styles.descriptionBlock}>
                    <SimpleRichEditor
                      commands={['bold', 'italic', 'link', 'image']}
                      content={mi.body || ''}
                      placeholder={`${t('Description')}...`}
                      onChange={(value) => handleMediaItemFieldChange('body', value.content)}
                    />
                    <GrowingTextarea
                      allowEnterKey={true}
                      class={styles.lyrics}
                      placeholder={t('Song lyrics')}
                      onChange={(value) => handleMediaItemFieldChange('lyrics', value)}
                      initialValue={mi.lyrics || ''}
                    />
                  </div>
                </Show>
              </Show>
            </li>
          )}
        </For>
      </ul>
    </Show>
  )
}
