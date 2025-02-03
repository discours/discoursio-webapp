import { Blockquote, BlockquoteOptions } from '@tiptap/extension-blockquote'

export type QuoteTypes = 'quote' | 'punchline'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    CustomBlockquote: {
      toggleBlockquote: (type: QuoteTypes) => ReturnType
      setBlockQuoteFloat: (float: null | 'left' | 'right') => ReturnType
    }
  }
}

export const CustomBlockquote = Blockquote.extend({
  name: 'blockquote',
  group: 'block',
  content: 'block+',

  addOptions(): BlockquoteOptions {
    return {
      HTMLAttributes: { class: 'blockquote' }
    } as BlockquoteOptions
  },

  addAttributes() {
    return {
      type: { default: 'quote' },
      float: { default: null }
    }
  },
  addCommands() {
    return {
      toggleBlockquote:
        (type?: QuoteTypes) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, type ? { 'data-type': type } : {}),
      setBlockQuoteFloat:
        (value: null | 'left' | 'right') =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { 'data-float': value })
    }
  }
})
