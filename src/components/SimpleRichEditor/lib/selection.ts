import { createSelection, getTextNodes } from '@solid-primitives/selection'
import { Accessor, createEffect, createMemo, onCleanup } from 'solid-js'

export const filterTextNodes = (nodes: Node[]): Text[] =>
  nodes.filter((node): node is Text => node.nodeType === Node.TEXT_NODE)

export interface SelectionState {
  range: Range | null
  text: string
  isEmpty: boolean
  position: {
    top: number
    left: number
  }
}

/**
 * Вычисляет позицию и смещение для Range
 */
export const getRangeArgs = (pos: number, textNodes: Text[]): [Text, number] => {
  let currentPos = 0

  for (const node of textNodes) {
    const length = node.length
    if (currentPos + length >= pos) {
      return [node, pos - currentPos]
    }
    currentPos += length
  }

  // Возвращаем последний узел если позиция за пределами
  return [textNodes[textNodes.length - 1], textNodes[textNodes.length - 1].length]
}

/**
 * Получает позицию в текстовых узлах для контейнера и смещения
 */
export const getRangePos = (container: Node, offset: number, textNodes: Text[]): [Text, number] => {
  if (container.nodeType === Node.TEXT_NODE) {
    const nodeIndex = textNodes.indexOf(container as Text)
    if (nodeIndex !== -1) {
      return [container as Text, offset]
    }
  }

  // Для элемента ищем текстовый узел по смещению
  const targetNode = textNodes[offset] || textNodes[textNodes.length - 1]
  return [targetNode, 0]
}

/**
 * Хук для работы с выделением в редакторе
 */
export const useEditorSelection = (editorRef: Accessor<HTMLDivElement | undefined>) => {
  const [selection, setSelection] = createSelection()

  // Мемоизируем состояние выделения
  const selectionState = createMemo(() => {
    const sel = selection()
    if (!(sel && editorRef())) return null

    const [node, start, end] = sel
    if (!(node && node === editorRef())) return null

    // Получаем Range из позиций
    const range = document.createRange()
    const textNodes = filterTextNodes(getTextNodes(node))

    const [startNode, startOffset] = getRangeArgs(start, textNodes)
    const [endNode, endOffset] = getRangeArgs(end, textNodes)

    if (!(startNode && endNode)) return null

    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)

    const rect = range.getBoundingClientRect()

    return {
      range,
      text: range.toString(),
      isEmpty: start === end,
      position: {
        top: rect.top,
        left: rect.left + rect.width / 2
      }
    }
  })

  const handleSelectionChange = () => {
    const state = selectionState()
    if (!state) return null
    return window.getSelection()
  }

  createEffect(() => {
    const handler = () => {
      const sel = window.getSelection()
      if (!(sel?.rangeCount && editorRef())) return

      const range = sel.getRangeAt(0)
      if (!editorRef()?.contains(range.commonAncestorContainer)) return

      const textNodes = filterTextNodes(getTextNodes(editorRef()!))
      const [, startOffset] = getRangePos(range.startContainer, range.startOffset, textNodes)
      const [, endOffset] = getRangePos(range.endContainer, range.endOffset, textNodes)

      setSelection([editorRef()!, startOffset, endOffset])
    }

    document.addEventListener('selectionchange', handler)
    onCleanup(() => document.removeEventListener('selectionchange', handler))
  })

  return {
    selection,
    selectionState,
    handleSelectionChange
  }
}

export const isLinkActive = () => {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return false

  const range = sel.getRangeAt(0)
  const commonAncestor = range.commonAncestorContainer
  return !!(commonAncestor.nodeType === Node.ELEMENT_NODE
    ? (commonAncestor as Element).closest('a')
    : commonAncestor.parentElement?.closest('a'))
}
