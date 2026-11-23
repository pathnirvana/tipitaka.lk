/** open.tipitaka.lk's name and links (server/flavor.go has the same name) */
import { script } from './script'

export const SITE_NAME = 'Buddha Jayanti Tipitaka'
export const SITE = 'https://open.tipitaka.lk'

/** the link of a sutta, or of a paragraph of it, in the script of the page */
export const pageLink = (key: string, eInd?: [number, number] | null) => `${SITE}/${script}/${key}${eInd ? `/${eInd[0]}-${eInd[1]}` : ''}`

/** the links at the end of the side panel (components/SidePanel.vue), after the two editions (composables/editions.ts):
 * add a page or a site here. label: English, the key of its translation (src/i18n) */
export const LINKS: { label: string; href: string; icon: 'translate' | 'book' | 'github' | 'email' | 'link' }[] = [
  { label: 'Source code', href: 'https://github.com/pathnirvana/tipitaka.lk', icon: 'github' },
  { label: 'Contact', href: 'mailto:pathnirvana@gmail.com', icon: 'email' },
]
