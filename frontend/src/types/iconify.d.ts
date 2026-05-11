export {}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'iconify-icon': {
        icon: string
        width?: string | number
        height?: string | number
        flip?: string
        rotate?: string | number
        class?: string
        className?: string
        style?: Record<string, string | number>
        title?: string
        id?: string
      }
    }
  }
}
