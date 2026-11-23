/** the parts of the tipitaka a search covers: tipitaka.lk's filter (stores/search.ts, components/FilterDialog.vue) over the texts of this site */
import { computed } from 'vue'
import { FILTER_KEYS } from '@shared/constants'
import { useSearch } from '@/stores/search'

/** the parts that can be searched: the mūla texts (the aṭṭhakathā are not on this site yet: drop the test to add them) */
export const SEARCH_KEYS: string[] = FILTER_KEYS.filter(k => !/^(atta-|anya)/.test(k))

export function useSearchFilter(type: 'title' | 'fts') {
  const search = useSearch()
  /** the chosen parts; none chosen (or only parts this site does not have) searches all */
  const keys = computed(() => {
    const k = search.filter[type].keys.filter(x => SEARCH_KEYS.includes(x))
    return k.length ? k : SEARCH_KEYS
  })
  const limited = computed(() => keys.value.length < SEARCH_KEYS.length)
  /** the groups of the chosen parts (indexes of FILTER_KEYS, as in the fts index and the title index) */
  const groups = computed(() => keys.value.map(k => (FILTER_KEYS as readonly string[]).indexOf(k)))
  const set = (k: string[]) => { search.filter[type].keys = SEARCH_KEYS.filter(x => k.includes(x)) }
  return { keys, limited, groups, set }
}
