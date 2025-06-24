import { clsx } from 'clsx'
import styles from './ArticleCardSkeleton.module.scss'
import { Show } from 'solid-js'

interface ArticleCardSkeletonProps {
    class?: string
    size?: 'small' | 'medium' | 'large' | 'noimage'
}

/**
 * Мерцающий скелетон карточки статьи
 * Показывается вместо Loading во время загрузки контента
 */
export const ArticleCardSkeleton = (props: ArticleCardSkeletonProps) => {
    return (
        <div
            class={clsx(
                styles.skeleton,
                styles[`skeleton--${props.size || 'medium'}`],
                props.class
            )}
        >
            <Show when={props.size !== 'noimage'}>
                {/* Заглушка обложки */}
                <div class={styles.skeletonCover} />
            </Show>

            {/* Заглушка контента */}
            <div class={styles.skeletonContent}>
                {/* Заглушка заголовка - компактно */}
                <div class={styles.skeletonTitle} />

                {/* Заглушка описания - только одна строка */}
                <div class={clsx(styles.skeletonDescription, styles.skeletonDescriptionShort)} />

                {/* Заглушка метаданных */}
                <div class={styles.skeletonMeta}>
                    <div class={styles.skeletonAuthor} />
                    <div class={styles.skeletonDate} />
                </div>
            </div>
        </div>
    )
} 