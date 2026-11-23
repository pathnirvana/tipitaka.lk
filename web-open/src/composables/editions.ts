/**
 * The same passage in the other editions: the Chaṭṭha Saṅgāyana edition on tipitaka.app, in the script of the page
 * (text.db entry_cst: the paragraph there of an entry, from dev/cst-map), and the BJT Sinhala translation on tipitaka.lk.
 */
import { computed, ref, watch } from 'vue'
import { getData } from '@/data/source'
import { useTabs } from '@/stores/tabs'
import { useRoute } from 'vue-router'
import { script } from '@o/script'

export const CST_SITE = 'https://tipitaka.app', LK_SITE = 'https://tipitaka.lk'
interface CstRow { key: string; para: number; page_idx: number; entry_idx: number }

/** the paragraph of tipitaka.app of an entry; of the next entry that has one when it is on the same or the next page */
export async function cstLink(file: string, page: number, entry: number): Promise<string | null> {
  const r = (await getData().query<CstRow>('text.cst', { file, page, entry }).catch(() => []))[0]
  return r && r.page_idx <= page + 1 ? `${CST_SITE}/${script}/${r.key}#p${r.para}` : null
}
/** the Sinhala translation of a sutta, at a paragraph */
export const sinhalaLink = (key: string, eInd?: [number, number] | null) => `${LK_SITE}/${key}${eInd ? `/${eInd[0]}-${eInd[1]}` : ''}/sinh`

/** the links of the side panel: the text of the active tab in the other editions, the sites themselves on other pages */
export function useEditionLinks() {
  const tabs = useTabs(), route = useRoute()
  const cst = ref(`${CST_SITE}/${script}`)
  const reading = computed(() => (route.name === 'Home' ? tabs.activeTab : undefined))
  watch(() => [reading.value?.key, reading.value?.node?.file] as const, async ([key]) => {
    const node = reading.value?.node
    cst.value = `${CST_SITE}/${script}`
    if (!key || !node) return
    const link = await cstLink(node.file, node.page_idx, node.entry_idx)
    if (link && reading.value?.key === key) cst.value = link
  }, { immediate: true })
  const sinhala = computed(() => (reading.value?.node ? sinhalaLink(reading.value.key) : LK_SITE))
  return { cst, sinhala }
}
