import { EditorState } from './state'

export const useKeyboardHandlers = (
  state: EditorState,
  execCommand: (command: string, value?: string) => void,
  handleSubmit: () => void,
  handleLinkButtonClick: () => void,
  handleRedo?: () => void,
  handleUndo?: () => void
) => ({
  /* Обработчик клавиатуры 
    Enter - сохраняет изменения
    Shift + Enter - вставляет блок цитаты
    Ctrl + B - жирный текст
    Ctrl + I - курсив
    Ctrl + U - подчеркнутый текст
    Ctrl + K - ссылка
    Ctrl + Y - повторить (Redo)
    Ctrl + Z - отмена (Undo)
  */
  handleKeyDown: (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
      return
    }

    if (e.key === 'Enter' && e.shiftKey && state.format.block.blockquote) {
      e.preventDefault()
      execCommand('formatBlock', '<p>')
      return
    }

    if (e.key === 'Enter' && !e.shiftKey && state.format.block.blockquote) {
      const selection = window.getSelection()
      if (!selection) return

      const range = selection.getRangeAt(0)
      const blockquote = range.startContainer.parentElement?.closest('blockquote')

      if (blockquote && range.startContainer.textContent?.trim() === '') {
        e.preventDefault()
        execCommand('formatBlock', '<p>')

        const emptyP = blockquote.querySelector('p:empty')
        if (emptyP) {
          emptyP.remove()
        }
      }
    }

    if (e.metaKey || e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'b': {
          e.preventDefault()
          execCommand('bold')
          break
        }
        case 'i': {
          e.preventDefault()
          execCommand('italic')
          break
        }
        case 'u': {
          e.preventDefault()
          execCommand('underline')
          break
        }
        case 'k': {
          e.preventDefault()
          handleLinkButtonClick()
          break
        }
        case 'y': {
          e.preventDefault()
          handleRedo?.()
          break
        }
        case 'z': {
          e.preventDefault()
          handleUndo?.()
          break
        }
        default: {
          break
        }
      }
    }
  }
})
