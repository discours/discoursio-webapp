import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    Footnote: {
      setFootnote: (options: { value: string }) => ReturnType
      updateFootnote: (options: { value: string }) => ReturnType
      deleteFootnote: () => ReturnType
    }
  }
}

export const Footnote = Node.create({
  name: 'footnote',
  addOptions() {
    return {
      HTMLAttributes: { class: 'footnote' }
    }
  },
  group: 'inline',
  content: 'text*',
  inline: true,
  isolating: true,

  addAttributes() {
    return {
      value: {
        default: null,
        parseHTML: (element) => element.dataset.value || null,
        renderHTML: (attributes) => {
          return {
            'data-value': attributes.value
          }
        }
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'footnote'
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['footnote', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setFootnote:
        (attributes) =>
        ({ tr, state }) => {
          const { selection } = state
          const position = selection.$to.pos
          const node = this.type.create(attributes) // Type assertion to bypass type mismatch
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          tr.insert(position, node as any)
          return true
        },
      updateFootnote:
        (newValue) =>
        ({ tr, state }) => {
          const { selection } = state
          const { $from, $to } = selection

          if ($from.parent.type.name === 'footnote' || $to.parent.type.name === 'footnote') {
            const node = $from.parent.type.name === 'footnote' ? $from.parent : $to.parent
            const pos = $from.parent.type.name === 'footnote' ? $from.pos - 1 : $to.pos - 1

            const newNode = node.type.create({ value: newValue })
            tr.setNodeMarkup(pos, null, newNode.attrs)

            return true
          }

          return false
        },
      deleteFootnote:
        () =>
        // eslint-disable-next-line unicorn/consistent-function-scoping
        ({ tr, state }) => {
          const { selection } = state
          const { $from, $to } = selection

          if ($from.parent.type.name === 'footnote' || $to.parent.type.name === 'footnote') {
            const startPos = $from.start($from.depth)
            const endPos = $to.end($to.depth)
            tr.delete(startPos, endPos)
            return true
          }

          return false
        }
    }
  }
})
