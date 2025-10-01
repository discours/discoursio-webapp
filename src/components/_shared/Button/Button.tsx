import { clsx } from 'clsx'
import type { JSX } from 'solid-js'

import styles from './Button.module.scss'

/**
 * Типы вариантов кнопки для консистентного дизайна в приложении
 */
export type ButtonVariant =
  | 'primary' // Основная кнопка (синяя)
  | 'secondary' // Вторичная кнопка (серая)
  | 'bordered' // С рамкой
  | 'inline' // Встроенная (без фона)
  | 'light' // Светлая (белая с рамкой)
  | 'outline' // Контурная (только рамка)
  | 'danger' // Опасная (красная)

/**
 * Свойства компонента Button
 */
type Props = {
  /** Текст всплывающей подсказки при наведении */
  title?: string

  /** Содержимое кнопки - текст или JSX элемент */
  value: string | JSX.Element

  /** Размер кнопки (S, M, L) */
  size?: 'S' | 'M' | 'L'

  /** Визуальный вариант кнопки */
  variant?: ButtonVariant

  /** HTML тип кнопки */
  type?: 'submit' | 'button'

  /** Состояние загрузки - кнопка неактивна и показывает индикатор */
  loading?: boolean

  /** Принудительная неактивность кнопки */
  disabled?: boolean

  /** Обработчик клика по кнопке */
  onClick?: (event?: MouseEvent) => void

  /** Дополнительные CSS классы */
  class?: string

  /** Ref для прямого доступа к DOM элементу */
  ref?: HTMLButtonElement | ((el: HTMLButtonElement) => void)

  /** Специальный стиль для кнопки подписки */
  isSubscribeButton?: boolean

  // ARIA атрибуты для доступности
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-expanded'?: boolean
  'aria-pressed'?: boolean
}

/**
 * Универсальный компонент Button с полной поддержкой доступности и состояний.

 * Компонент предоставляет консистентный интерфейс для всех кнопок в приложении
 * с поддержкой различных визуальных вариантов, размеров и состояний.

 * Особенности:
 * - Полная поддержка доступности (ARIA)
 * - Адаптивные размеры (S, M, L)
 * - Множественные визуальные варианты
 * - Состояния загрузки и неактивности
 * - Поддержка кастомных стилей

 * @param props - Свойства кнопки
 * @returns JSX.Element - Отрендеренная кнопка

 * @example
 * // Простая кнопка
 * <Button value="Отправить" onClick={handleSubmit} />

 * @example
 * // Кнопка подписки с загрузкой
 * <Button
 *   value={isFollowing ? "Отписаться" : "Подписаться"}
 *   variant="primary"
 *   loading={isLoading}
 *   isSubscribeButton={true}
 *   onClick={handleFollow}
 * />

 * @example
 * // Опасная кнопка с подтверждением
 * <Button
 *   value="Удалить"
 *   variant="danger"
 *   onClick={handleDelete}
 *   aria-label="Удалить публикацию"
 * />
 */
export const Button = (props: Props) => {
  return (
    <button
      ref={(el) => {
        if (typeof props.ref === 'function') {
          props.ref(el)
          return
        }
        props.ref = el
      }}
      title={props.title || (typeof props.value === 'string' ? props.value : '')}
      onClick={props.onClick}
      type={props.type ?? 'button'}
      disabled={props.loading || props.disabled}
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
      aria-expanded={props['aria-expanded']}
      aria-pressed={props['aria-pressed']}
      aria-busy={props.loading}
      class={clsx(
        styles.button,
        styles[props.size ?? 'M'],
        styles[props.variant ?? 'primary'],
        {
          [styles.loading]: props.loading,
          [styles.subscribeButton]: props.isSubscribeButton
        },
        props.class
      )}
    >
      {props.value}
    </button>
  )
}
