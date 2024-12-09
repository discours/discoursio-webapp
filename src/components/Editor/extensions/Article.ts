import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    Article: {
      toggleArticle: () => ReturnType
      setArticleFloat: (float: null | 'half-left' | 'half-right') => ReturnType
      setArticleBg: (bg: null | string) => ReturnType
    }
  }
}

export const ArticleNode = Node.create({
  name: 'article',
  group: 'block',
  content: 'block+',

  parseHTML() {
    return [{ tag: 'article' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['article', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addOptions() {
    return {
      HTMLAttributes: {
        'data-type': 'incut'
      }
    }
  },

  addAttributes() {
    return {
      'data-float': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-float'),
        renderHTML: (attributes) => {
          if (!attributes['data-float']) return {}
          return { 'data-float': attributes['data-float'] }
        }
      },
      'data-bg': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-bg'),
        renderHTML: (attributes) => {
          if (!attributes['data-bg']) return {}
          return { 'data-bg': attributes['data-bg'] }
        }
      }
    }
  },

  addCommands() {
    return {
      toggleArticle:
        () =>
        ({ commands }) => {
          return commands.toggleWrap(this.name)
        },
      setArticleFloat:
        (float) =>
        ({ commands }) => {
          if (float === null) {
            return commands.resetAttributes(this.name, ['data-float'])
          }
          return commands.updateAttributes(this.name, { 'data-float': float })
        },
      setArticleBg:
        (bg) =>
        ({ commands }) => {
          if (bg === null) {
            return commands.resetAttributes(this.name, ['data-bg'])
          }
          return commands.updateAttributes(this.name, { 'data-bg': bg })
        }
    }
  }
})

export default ArticleNode
