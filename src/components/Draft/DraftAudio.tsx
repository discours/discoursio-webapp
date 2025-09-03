import { Show, untrack } from 'solid-js'
import { useLocalize } from '~/context/localize'
import { Draft, MediaItem } from '~/graphql/generated/graphql'
// getImageUrl больше не нужен - middleware перехватывает CDN запросы
import styles from '~/styles/views/EditView.module.scss'
import { DropArea } from '../_shared/DropArea'
import { Icon } from '../_shared/Icon'
import { Popover } from '../_shared/Popover'

/**
 * Компонент для аудио профиля
 *
 * @param props Свойства компонента
 * @returns React компонент
 */
export const AudioProfile = (props: {
  draft?: Draft
  mediaItems: MediaItem[]
  onFieldChange: (key: string, value: string) => void
  onCoverChange: (url: string) => void
}) => {
  const { t } = useLocalize()

  return (
    <>
      <div class={styles.additional}>
        <input
          type="text"
          placeholder={t('Artist...')}
          class={styles.additionalInput}
          value={props.mediaItems[0]?.artist || ''}
          onChange={(event) => untrack(() => props.onFieldChange('artist', event.target.value))}
        />
        <input
          type="number"
          min="1900"
          max={new Date().getFullYear()}
          step="1"
          class={styles.additionalInput}
          placeholder={t('Release date...')}
          value={props.mediaItems[0]?.date || ''}
          onChange={(event) => untrack(() => props.onFieldChange('date', event.target.value))}
        />
        <input
          type="text"
          placeholder={t('Genre...')}
          class={styles.additionalInput}
          value={props.mediaItems[0]?.genre || ''}
          onChange={(event) => untrack(() => props.onFieldChange('genre', event.target.value))}
        />
      </div>

      <Show
        when={props.draft?.cover}
        fallback={
          <DropArea
            isSquare={true}
            placeholder={t('Add cover')}
            description={
              <>
                {t('min. 1400×1400 pix')}
                <br />
                {t('jpg, .png, max. 10 mb.')}
              </>
            }
            isMultiply={false}
            fileType={'image'}
            onUpload={(val: { url: string }[]) => untrack(() => props.onCoverChange(val[0].url))}
          />
        }
      >
        <div
          class={styles.cover}
          style={{
            'background-image': `url(${props.draft?.cover || ''})`
          }}
        >
          <Popover content={t('Delete cover')}>
            {(triggerRef: (_el: HTMLElement | null) => void) => (
              <div ref={triggerRef} class={styles.delete} onClick={() => untrack(() => props.onCoverChange(''))}>
                <Icon name="close-white" />
              </div>
            )}
          </Popover>
        </div>
      </Show>
    </>
  )
}
