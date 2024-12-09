import 'solid-js'

// workaround for email templates
declare module 'solid-js' {
  namespace JSX {
    interface HTMLAttributes<T> {
      align?: string
      border?: string
      cellpadding?: string
      cellspacing?: string
      valign?: string
      style?: string | { [key: string]: string | number }
      children?: any
    }
    interface AnchorHTMLAttributes<T> extends HTMLAttributes<T> {
      children?: any
    }
    interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
      style?: string | { [key: string]: string | number }
    }
    interface TdHTMLAttributes<T> extends HTMLAttributes<T> {
      children?: any
    }
  }
} 