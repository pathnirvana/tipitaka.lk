/**
 * open.tipitaka.lk (dev-docs/open-flavor.md): the BJT pāḷi in the scripts of shared/scripts.ts. As the pitaka.lk reader
 * (web-pitaka/vite.config.ts) it is a small app that imports tipitaka.lk's components and stores from web/src (`@/…`)
 * and replaces a few modules for every importer (OVERRIDES); the rest of this app is in src/ (`@o/…`).
 * Served by the Go server with -flavor open; the url starts with the script (/thai/dn-1-1).
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

const root = fileURLToPath(new URL('.', import.meta.url))
const repo = fileURLToPath(new URL('..', import.meta.url))
const lkSrc = path.join(repo, 'web/src'), src = path.join(root, 'src')

/** module of the repo -> its replacement in src/ */
export const OVERRIDES: Record<string, string> = {
  'web/src/stores/settings.ts': 'overrides/settings.ts',
  'web/src/composables/storage.ts': 'overrides/storage.ts',
  'shared/beautify.ts': 'overrides/beautify.ts', // the pāḷi in the script of the url
  'web/src/components/RichText.ts': 'overrides/RichText.ts',
  'web/src/components/TreeNode.vue': 'overrides/TreeNode.vue', // labels
}

function overrides(): Plugin {
  const map = new Map(Object.entries(OVERRIDES).map(([lk, mine]) => [path.join(repo, lk), path.join(src, mine)]))
  return {
    name: 'open-overrides',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      const r = await this.resolve(source, importer, { ...options, skipSelf: true })
      const to = r && map.get(r.id.split('?')[0])
      return to && to !== importer?.split('?')[0] ? { ...r, id: to } : r
    },
  }
}

// the db is tipitaka.lk's (server/flavor.go)
function buildInfo() {
  for (const f of [`${repo}db/build-info.json`, `${repo}e2e/fixtures/db/build-info.json`]) {
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'))
  }
  return { api_hash: '', db_version: 1 }
}

export default defineConfig({
  root,
  base: '/',
  publicDir: path.join(repo, 'web/public'), // tipitaka.lk's: the audio file map, images
  plugins: [
    overrides(),
    vue(),
    helpMarkdown(),
    Icons({ compiler: 'vue3' }),
    legacy({ targets: browsers, modernPolyfills: true }),
  ],
  resolve: {
    alias: {
      '@shared': path.join(repo, 'shared'),
      '@o': src,
      '@': lkSrc,
    },
  },
  define: {
    __IS_APP__: JSON.stringify(false),
    __BUILD_INFO__: JSON.stringify(buildInfo()),
  },
  css: {
    postcss: {
      plugins: [tailwindcss({ config: `${root}tailwind.config.cjs` }), postcssPresetEnv({ browsers, stage: 3 }), autoprefixer({ overrideBrowserslist: browsers })],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2015',
    chunkSizeWarningLimit: 800,
  },
  server: {
    host: '0.0.0.0',
    port: 8083,
    proxy: { '/api': 'http://localhost:8404' },
  },
})
