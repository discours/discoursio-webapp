/**
 * Gets the format state for a given command
 * @param command - The execCommand to check
 * @param selection - The current selection
 * @returns boolean indicating if the format is active
 */
export const formatCommand = (command: string, selection: Selection | null): boolean => {
  if (!selection) return false

  try {
    // Special case for links since document.queryCommandState doesn't work reliably
    if (command === 'link') {
      const range = selection.getRangeAt(0)
      const ancestor = range.commonAncestorContainer
      return !!(ancestor.nodeType === Node.ELEMENT_NODE
        ? (ancestor as Element).closest('a')
        : ancestor.parentElement?.closest('a'))
    }

    // Special case for blockquote since document.queryCommandState doesn't work
    if (command === 'blockquote') {
      const range = selection.getRangeAt(0)
      const ancestor = range.commonAncestorContainer
      return !!(ancestor.nodeType === Node.ELEMENT_NODE
        ? (ancestor as Element).closest('blockquote')
        : ancestor.parentElement?.closest('blockquote'))
    }

    // For other commands, use queryCommandState
    return document.queryCommandState(command)
  } catch (e) {
    console.warn(`Failed to get format state for ${command}:`, e)
    return false
  }
}

/**
 * Gets format states for block-level commands
 */
export const getFormatStates = (selection: Selection | null, editor: HTMLElement) => ({
  block: {
    h1: !!editor.querySelector('h1'),
    h2: !!editor.querySelector('h2'),
    h3: !!editor.querySelector('h3'),
    blockquote: formatCommand('blockquote', selection),
    orderedList: formatCommand('insertOrderedList', selection),
    unorderedList: formatCommand('insertUnorderedList', selection),
    incut: !!editor.querySelector('.incut')
  },
  media: {
    image: !!editor.querySelector('img'),
    video: !!editor.querySelector('iframe'),
    figcaption: !!editor.querySelector('figcaption')
  },
  text: {
    bold: formatCommand('bold', selection),
    italic: formatCommand('italic', selection),
    underline: formatCommand('underline', selection),
    link: formatCommand('link', selection),
    strikethrough: formatCommand('strikethrough', selection)
  }
})
