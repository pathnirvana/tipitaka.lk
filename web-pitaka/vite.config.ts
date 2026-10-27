/**
 * The pitaka.lk reader (dev-docs/pitaka-flavor.md): a small app of its own that imports tipitaka.lk's components and
 * stores from web/src (`@/…`). A few of web/src's modules are replaced for every importer, also the relative imports
 * inside web/src (OVERRIDES: the settings, the storage keys, the user guide); everything else of this app is in src/
 * (`@p/…`). Served under /main/ (server -flavor pitaka); the apps (VITE_APP=1) use the hash router as tipitaka.lk's.
 */
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'
import Icons from 'unplugin-icons/vite'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import postcssPresetEnv from 'postcss-preset-env'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { helpMarkdown } from '../web/help'
import { browsers } from '../web/vite.config'

const isApp = process.env.VITE_APP === '1'
const root = fileURLToPath(new URL('.', import.meta.url))
const repo = fileURLToPath(new URL('..', import.meta.url))
const lkSrc = path.join(repo, 'web/src'), src = path.join(root, 'src')

/** web/src module -> its replacement in src/ */
export const OVERRIDES: Record<string, string> = {
  'stores/settings.ts': 'overrides/settings.ts',
  'composables/storage.ts': 'overrides/storage.ts',
  'help/si.md': 'help/si.md',
  'components/InlineDict.vue': 'overrides/InlineDict.vue',
}

function overrides(): Plugin {
  const map = new Map(Object.entries(OVERRIDES).map(([lk, mine]) => [path.join(lkSrc, lk), path.join(src, mine)]))
  return {
    name: 'pitaka-overrides',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      const r = await this.resolve(source, importer, { ...options, skipSelf: true })
      const to = r && map.get(r.id.split('?')[0])
      return to && to !== importer?.split('?')[0] ? { ...r, id: to } : r
    },
  }
}

function buildInfo() {
  for (const f of [`${repo}db/pitaka-build-info.json`, `${repo}e2e/fixtures/db/pitaka-build-info.json`]) {
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'))
  }
  return { api_hash: '', db_version: 1 }
}

export default defineConfig({
  root,
  base: isApp ? './' : '/main/',
  plugins: [
    overrides(),
    vue(),
    helpMarkdown(),
    Icons({ compiler: 'vue3' }),
    legacy({ targets: browsers, modernPolyfills: true, renderModernChunks: !isApp }),
  ],
  resolve: {
    alias: {
      '@shared': path.join(repo, 'shared'),
      '@p': src,
      '@': lkSrc,
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
    port: 8082,
    proxy: { '/main/api': 'http://localhost:8403' },
  },
})
