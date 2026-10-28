/** pitaka.lk's name and links (server/flavor.go has the same name) */
export const SITE_NAME = 'සරල සිංහල ත්‍රිපිටකය'
export const SITE = 'https://pitaka.lk/main'

/** the link of a sutta, or of a paragraph of it, in the language it was taken from (as tipitaka.lk's: /dn-1-1/3-2/pali) */
export const pageLink = (key: string, lang: 'pali' | 'sinh', eInd?: [number, number] | null) =>
  `${SITE}/${key}${eInd ? `/${eInd[0]}-${eInd[1]}` : ''}/${lang}`
