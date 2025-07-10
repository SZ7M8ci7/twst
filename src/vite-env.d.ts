/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Google Analytics gtag function declaration
interface Window {
  gtag: (
    command: 'config' | 'set' | 'event',
    targetId: string,
    config?: {
      page_path?: string
      page_title?: string
      [key: string]: any
    }
  ) => void
  dataLayer: any[]
}
