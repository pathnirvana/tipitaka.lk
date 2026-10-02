import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'
import Icons from 'unplugin-icons/vite'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import postcssPresetEnv from 'postcss-preset-env'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

// VITE_APP=1 -> offline Android/iOS WebView build (file:// base, hash router, no ES modules)
const isApp = process.env.VITE_APP === '1'
const root = fileURLToPath(new URL('.', import.meta.url))
const repo = fileURLToPath(new URL('..', import.meta.url))
export const browsers = ['chrome >= 61', 'safari >= 12', 'ios >= 12', 'firefox >= 68', 'edge >= 79']

function buildInfo() {
  for (const f of [`${repo}db/build-info.json`, `${repo}e2e/fixtures/db/build-info.json`]) {
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'))
  }
  return { api_hash: '', db_version: 1 }
}

export default defineConfig({
  root,
  base: isApp ? './' : '/',
  plugins: [
    vue(),
    Icons({ compiler: 'vue3' }),
    legacy({ targets: browsers, modernPolyfills: true, renderModernChunks: !isApp }),
  ],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __IS_APP__: JSON.stringify(isApp),
    __BUILD_INFO__: JSON.stringify(buildInfo()),
  },
  css: {
    postcss: {
      plugins: [tailwindcss({ config: `${root}tailwind.config.cjs` }), postcssPresetEnv({ browsers, stage: 3 }), autoprefixer({ overrideBrowserslist: browsers })],
    },
  },
  build: {
    outDir: isApp ? 'dist-app' : 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2015',
    chunkSizeWarningLimit: 800,
  },
  server: {
    host: '0.0.0.0',
    port: 8081,
    proxy: { '/api': 'http://localhost:8400', '/tipitaka-query': 'http://localhost:8400', '/bjt-scanned-pages': 'http://localhost:8400' },
  },
})
