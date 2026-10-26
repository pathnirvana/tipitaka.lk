/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/vue" />

declare const __IS_APP__: boolean
declare const __BUILD_INFO__: { api_hash: string; db_version: number; content_hash?: string }

/** the user guide, compiled at build time (web/help.ts) */
declare module '*.md' {
  const page: { html: string; toc: { id: string; title: string }[] }
  export default page
}
declare module '*.sql?raw' {
  const text: string
  export default text
}
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

/** the apps' native bridge (dev-docs/native-bridge.md): Android's @JavascriptInterface, iOS's message handler, and the
 * answers through __tipitakaResolve; Wails' runtime in the desktop app */
interface Window {
  TipitakaNative?: { query(id: string, request: string): void; share?(text: string): void; setChromeColors?(top: string, bottom: string): void }
  webkit?: { messageHandlers?: { tipitaka?: { postMessage(m: { id: string; request: string }): void } } }
  __tipitakaResolve?: (id: string, response: string) => void
  runtime?: { BrowserOpenURL?(url: string): void }
}
