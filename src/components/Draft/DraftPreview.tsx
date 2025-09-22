import { Accessor, Show } from 'solid-js'
import { ExtendedDraft } from '~/context/drafts'
import { useLocalize } from '~/context/localize'

import styles from './DraftPreview.module.scss'

export const DraftPreview = (props: { previewData: Accessor<ExtendedDraft | null> }) => {
  const { t } = useLocalize()
  return (
    <div class={styles.container}>
      <div class={styles.row}>
        <div class={styles.col}>
          <article class={styles.article}>
            <Show when={props.previewData()?.cover}>
              <div class={styles.articleCover}>
                <img src={props.previewData()!.cover!} alt={props.previewData()?.title || ''} />
              </div>
            </Show>

            <h1 class={styles.articleTitle}>{props.previewData()?.title || t('Unnamed draft')}</h1>

            <Show when={props.previewData()?.subtitle}>
              <h2 class={styles.articleSubtitle}>{props.previewData()?.subtitle}</h2>
            </Show>

            <Show when={props.previewData()?.lead}>
              <div class={styles.articleLead} innerHTML={props.previewData()?.lead || ''} />
            </Show>

            <div class={styles.articleContent} innerHTML={props.previewData()?.body || ''} />
          </article>
        </div>
      </div>
    </div>
  )
}
