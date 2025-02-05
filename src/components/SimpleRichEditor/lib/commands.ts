/**
 * Execute editor command with error handling
 */
export const execEditorCommand = (editor: HTMLElement, command: string, value?: string): boolean => {
  try {
    editor.focus()
    // @ts-ignore - игнорируем deprecation warning
    return document.execCommand(command, false, value)
  } catch (e) {
    console.warn(`Failed to execute command ${command}:`, e)
    return false
  }
}
