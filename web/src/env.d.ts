/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/vue" />

declare const __IS_APP__: boolean
declare const __BUILD_INFO__: { api_hash: string; db_version: number; content_hash?: string }

declare module '*.sql?raw' {
  const text: string
  export default text
}
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

/** native bridge injected by the Android / iOS WebView apps (contract: docs/native-bridge.md) */
interface AndroidBridge {
  runAsync(rand: string, funcName: string, jsonParams: string): void
  runAsyncResult(rand: string): string
  getBjtParams?(): string
  showToast?(msg: string): void
}
interface Window {
  Android?: AndroidBridge
  [asyncKey: `asyncJava_${number}`]: { callback?: (ok: boolean) => void; resolve?: (v: string) => void; reject?: (e: string) => void }
}
declare const Android: AndroidBridge
