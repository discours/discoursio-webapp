import { EditorOptions } from '@tiptap/core'
import { AnyExtension, Editor } from '@tiptap/core'
import Dropcursor from '@tiptap/extension-dropcursor'
import Focus from '@tiptap/extension-focus'
import Gapcursor from '@tiptap/extension-gapcursor'
import HardBreak from '@tiptap/extension-hard-break'
import Highlight from '@tiptap/extension-highlight'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import ArticleNode from '~/components/Editor/extensions/Article'
import { CustomBlockquote } from '~/components/Editor/extensions/CustomBlockquote'
import { Figure } from '~/components/Editor/extensions/Figure'
import { Footnote } from '~/components/Editor/extensions/Footnote'
import { Span } from '~/components/Editor/extensions/Span'
import { ToggleTextWrap } from '~/components/Editor/extensions/ToggleTextWrap'

// Extend the Figure extension to include Figcaption
export const ImageFigure = Figure.extend({
  name: 'capturedImage',
  content: 'figcaption image'
})

/**
 * Обновляет расширения редактора, добавляя новые и удаляя указанные, без пересоздания инстанса редактора.
 * Сохраняет текущее выделение и фокус.
 *
 * @param {Editor} currentEditor - Текущий экземпляр редактора.
 * @param {Extension[]} [extensionsToAdd=[]] - Массив расширений для добавления.
 * @param {string[]} [extensionsToRemove=[]] - Массив имен расширений для удаления.
 *
 * @description
 * Эта функция выполняет следующие действия:
 * 1. Сохраняет текущее выделение.
 * 2. Удаляет указанные расширения из текущего списка.
 * 3. Добавляет новые расширения, избегая дубликатов.
 * 4. Обновляет менеджер расширений редактора.
 * 5. Пересоздает схему и состояние редактора.
 * 6. Обновляет view редактора с новым состоянием.
 * 7. Восстанавливает сохраненное выделение.
 * 8. Фокусирует редактор для применения изменений.
 *
 * @example
 * const editor = new Editor();
 * const newExtension = new CustomExtension();
 * updateEditorExtensions(editor, [newExtension], ['oldExtension']);
 */
export const updateEditorExtensions = (
  currentEditor: Editor,
  extensionsToAdd: AnyExtension[] = [],
  extensionsToRemove: string[] = []
) => {
  let currentExtensions = currentEditor.extensionManager.extensions

  // Сохраняем текущее выделение
  const { from, to } = currentEditor.state.selection

  // Удаляем указанные расширения
  if (extensionsToRemove.length > 0) {
    currentExtensions = currentExtensions.filter((ext) => !extensionsToRemove.includes(ext.name))
  }

  // Добавляем новые расширения, избегая дубликатов
  const updatedExtensions = [
    ...currentExtensions,
    ...extensionsToAdd.filter(
      (newExt) => !currentExtensions.some((currentExt) => currentExt.name === newExt.name)
    )
  ]

  // Обновляем расширения
  currentEditor.extensionManager.extensions = updatedExtensions

  // Получаем текущие плагины и обновляем их с новой схемой
  const plugins = currentEditor.extensionManager.plugins

  // Правильно реконфигурируем состояние с новыми плагинами
  const newState = currentEditor.state.reconfigure({ plugins })

  // Обновляем view с новым состоянием
  currentEditor.view.updateState(newState)

  // Восстанавливаем выделение, только если оно было валидным
  if (from < newState.doc.content.size && to <= newState.doc.content.size) {
    currentEditor.commands.setTextSelection({ from, to })
  }

  // Обновляем фокус только если редактор активен
  if (currentEditor.isFocused) {
    currentEditor.commands.focus()
  }
}

export const extensions: EditorOptions['extensions'] = [
  StarterKit.configure({
    heading: {
      levels: [2, 3, 4]
    },
    horizontalRule: {
      HTMLAttributes: {
        class: 'horizontalRule'
      }
    },
    blockquote: undefined
  }),
  Underline, // не входит в StarterKit
  Link.configure({ autolink: true, openOnClick: false }),
  Image,
  Highlight.configure({
    multicolor: true,
    HTMLAttributes: {
      class: 'highlight'
    }
  }),
  HorizontalRule.configure({ HTMLAttributes: { class: 'horizontalRule' } }),
  Highlight.configure({ multicolor: true, HTMLAttributes: { class: 'highlight' } }),
  Dropcursor,
  CustomBlockquote,
  Span,
  ToggleTextWrap,
  Footnote,
  Focus,
  Gapcursor,
  HardBreak,
  ArticleNode
]
