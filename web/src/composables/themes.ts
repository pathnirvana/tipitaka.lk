/** the colour themes (tipitaka.app): swatch colours for the side panel / settings, and the class set on <html> */
export type Theme = 'light' | 'sepia' | 'green' | 'dark' | 'auto'

export const THEMES: { id: Theme; label: string; bg: string; fg: string }[] = [
  { id: 'light', label: 'ආලෝකමත්', bg: '#fbf8f3', fg: '#2b2522' },
  { id: 'sepia', label: 'පැරණි කඩදාසි', bg: '#f4ecd8', fg: '#3b2f22' },
  { id: 'green', label: 'කොළ පැහැ', bg: '#e4ede0', fg: '#1e2a21' },
  { id: 'dark', label: 'අඳුරු', bg: '#1b1917', fg: '#e6dfd6' },
  // auto: light or dark as the system (split swatch)
  { id: 'auto', label: 'ස්වයංක්‍රීය', bg: 'linear-gradient(135deg, #fbf8f3 0 50%, #1b1917 50% 100%)', fg: '#2b2522' },
]
export const isTheme = (t: unknown): t is Theme => THEMES.some(x => x.id === t)

const systemDark = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null
/** the class of <html> for a theme ("theme-sepia", not "sepia": that is also Tailwind's sepia filter utility) */
export function themeClass(theme: Theme, dark = !!systemDark?.matches): string {
  const t = theme === 'auto' ? (dark ? 'dark' : 'light') : theme
  return t === 'light' ? '' : t === 'dark' ? 'dark' : `theme-${t}`
}
export function applyTheme(theme: Theme) {
  const cls = themeClass(theme)
  document.documentElement.className = cls
  // the browser toolbar on phones follows the page colour
  const bg = THEMES.find(t => t.id === (cls === 'dark' ? 'dark' : cls ? cls.slice(6) : 'light'))!.bg
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}
/** calls back when the system switches between light and dark (old WebViews only have addListener) */
export function onSystemDark(cb: () => void) {
  if (!systemDark) return
  if (systemDark.addEventListener) systemDark.addEventListener('change', cb)
  else systemDark.addListener(cb)
}
