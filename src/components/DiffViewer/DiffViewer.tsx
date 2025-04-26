import { DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT, diff_match_patch } from 'diff-match-patch'
import { Component, createMemo } from 'solid-js'

import styles from './DiffViewer.module.scss'

interface DiffViewerProps {
  oldText: string
  newText: string
}

/**
 * Компонент для визуализации различий между двумя текстами.
 * Использует библиотеку diff-match-patch для вычисления различий
 * и отображает их с помощью тегов <ins> и <del>.
 *
 * @param props.oldText - Исходный текст.
 * @param props.newText - Новый текст с предложенными изменениями.
 * @returns JSX элемент с подсвеченными различиями.
 *
 * @example
 * ```tsx
 * <DiffViewer oldText="Это старый текст." newText="Это новый текст с правками." />
 * ```
 */
export const DiffViewer: Component<DiffViewerProps> = (props) => {
  const dmp = new diff_match_patch()

  const diffs = createMemo(() => {
    // Перед сравнением нормализуем HTML-сущности, чтобы избежать ложных срабатываний
    // (например, &nbsp; vs пробел)
    const normalize = (text: string) => text.replace(/&nbsp;/g, ' ').trim()
    return dmp.diff_main(normalize(props.oldText), normalize(props.newText))
  })

  const diffHtml = createMemo(() => {
    let html = ''
    for (const [op, text] of diffs()) {
      switch (op) {
        case DIFF_INSERT: {
          // Оборачиваем вставленный текст в <ins>
          html += `<ins class="${styles.insertion}">${text}</ins>`
          break
        }
        case DIFF_DELETE: {
          // Оборачиваем удаленный текст в <del>
          html += `<del class="${styles.deletion}">${text}</del>`
          break
        }
        case DIFF_EQUAL: {
          // Оставляем совпадающий текст без изменений
          html += text
          break
        }
        default: {
          // Обрабатываем неизвестные типы операций
          console.warn(`Unknown diff operation: ${op}`)
          html += text
          break
        }
      }
    }
    return html
  })

  return (
    <div
      class={styles.diffContainer}
      // Используем dangerouslySetInnerHTML для вставки HTML с тегами <ins> и <del>
      // Убедимся, что входные тексты (props.oldText, props.newText) санитайзятся
      // перед передачей в этот компонент, если они приходят из недоверенного источника.
      // В данном случае diff-match-patch возвращает только текстовые фрагменты,
      // поэтому риск XSS минимален, но осторожность не помешает.
      innerHTML={diffHtml()}
    />
  )
}
