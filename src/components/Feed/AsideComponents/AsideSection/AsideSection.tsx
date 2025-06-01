import { clsx } from 'clsx'
import { JSX, Show, createSignal } from 'solid-js'
import { Icon } from '~/components/_shared/Icon'
import buttonStyles from '~/components/_shared/Button/Button.module.scss'
import styles from './AsideSection.module.scss'

export interface AsideSectionProps {
  title?: string
  children: JSX.Element
  class?: string
  collapsible?: boolean
  defaultExpanded?: boolean
  icon?: string
  variant?: 'default' | 'card' | 'minimal'
  noPadding?: boolean
  noBackground?: boolean
  /** Стиль кнопки для кликабельного заголовка (применяется только если collapsible=true) */
  buttonVariant?: 'primary' | 'secondary' | 'bordered' | 'inline' | 'light' | 'outline'
  /** Размер кнопки для кликабельного заголовка (применяется только если collapsible=true) */
  buttonSize?: 'S' | 'M' | 'L'
}

/**
 * AsideSection - универсальный компонент для боковых секций с возможностью сворачивания
 * 
 * @example
 * // Базовое использование
 * <AsideSection title="Настройка ленты">
 *   <p>Контент секции</p>
 * </AsideSection>
 * 
 * @example
 * // Сворачиваемая секция с кнопочными стилями
 * <AsideSection 
 *   title="Сообщество" 
 *   collapsible={true}
 *   buttonVariant="primary"
 *   buttonSize="M"
 *   icon="users"
 * >
 *   <p>Присоединяйтесь к нашему сообществу</p>
 * </AsideSection>
 * 
 * @example
 * // Различные варианты дизайна
 * <AsideSection 
 *   title="Рассылка" 
 *   variant="minimal"
 *   collapsible={true}
 *   buttonVariant="outline"
 *   icon="mail"
 * >
 *   <NewsletterForm />
 * </AsideSection>
 */
export const AsideSection = (props: AsideSectionProps) => {
  const [isExpanded, setIsExpanded] = createSignal(props.defaultExpanded ?? true)

  const toggleExpanded = () => {
    if (props.collapsible) {
      setIsExpanded(!isExpanded())
    }
  }

  const variant = props.variant || 'default'
  const buttonVariant = props.buttonVariant || 'light'
  const buttonSize = props.buttonSize || 'M'

  return (
    <section
      class={clsx(styles.asideSection, props.class, {
        [styles.cardVariant]: variant === 'card',
        [styles.minimalVariant]: variant === 'minimal',
        [styles.noPadding]: props.noPadding,
        [styles.noBackground]: props.noBackground
      })}
    >
      <Show when={props.title}>
        <div
          class={clsx(styles.asideSectionHeader, {
            [styles.collapsible]: props.collapsible,
            [styles.expanded]: isExpanded(),
            [styles.cardHeader]: variant === 'card',
            [styles.minimalHeader]: variant === 'minimal',
            // Добавляем стили кнопки для кликабельных заголовков
            [buttonStyles.button]: props.collapsible,
            [buttonStyles[buttonVariant]]: props.collapsible,
            [buttonStyles[buttonSize]]: props.collapsible
          })}
          onClick={toggleExpanded}
        >
          <Show when={props.icon}>
            <Icon name={props.icon!} class={styles.headerIcon} />
          </Show>
          <h4 class={styles.asideSectionTitle}>{props.title}</h4>
          <Show when={props.collapsible}>
            <Icon
              name="chevron-down"
              class={clsx(styles.expandIcon, {
                [styles.rotated]: isExpanded()
              })}
            />
          </Show>
        </div>
      </Show>

      <div
        class={clsx(styles.asideSectionContent, {
          [styles.collapsed]: props.collapsible && !isExpanded(),
          [styles.cardContent]: variant === 'card',
          [styles.minimalContent]: variant === 'minimal'
        })}
      >
        {props.children}
      </div>
    </section>
  )
}
