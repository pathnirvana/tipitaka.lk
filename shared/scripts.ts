/**
 * Pali scripts (ISO 15924 codes of @pnfo/pali-converter) and the v2 tipitaka.app codes (settings migration,
 * old ?a=file-line-script links). Order = display order. Must match server/convert/convert.go Scripts.
 */
export interface ScriptInfo { code: string; name: string; native: string; lang: string /* BCP 47 for hreflang/lang */ }

export const SCRIPTS: ScriptInfo[] = [
  { code: 'latn', name: 'Roman', native: 'Roman', lang: 'pi-Latn' },
  { code: 'sinh', name: 'Sinhala', native: 'සිංහල', lang: 'pi-Sinh' },
  { code: 'deva', name: 'Devanagari', native: 'देवनागरी', lang: 'pi-Deva' },
  { code: 'thai', name: 'Thai', native: 'ไทย', lang: 'pi-Thai' },
  { code: 'mymr', name: 'Myanmar', native: 'မြန်မာ', lang: 'pi-Mymr' },
  { code: 'khmr', name: 'Khmer', native: 'ខ្មែរ', lang: 'pi-Khmr' },
  { code: 'laoo', name: 'Lao', native: 'ລາວ', lang: 'pi-Laoo' },
  { code: 'beng', name: 'Bengali', native: 'বাংলা', lang: 'pi-Beng' },
  { code: 'tibt', name: 'Tibetan', native: 'བོད་ཡིག', lang: 'pi-Tibt' },
  { code: 'cyrl', name: 'Cyrillic', native: 'Кириллица', lang: 'pi-Cyrl' },
  { code: 'guru', name: 'Gurmukhi', native: 'ਗੁਰਮੁਖੀ', lang: 'pi-Guru' },
  { code: 'gujr', name: 'Gujarati', native: 'ગુજરાતી', lang: 'pi-Gujr' },
  { code: 'telu', name: 'Telugu', native: 'తెలుగు', lang: 'pi-Telu' },
  { code: 'knda', name: 'Kannada', native: 'ಕನ್ನಡ', lang: 'pi-Knda' },
  { code: 'mlym', name: 'Malayalam', native: 'മലയാളം', lang: 'pi-Mlym' },
  { code: 'taml', name: 'Tamil', native: 'தமிழ்', lang: 'pi-Taml' },
  { code: 'asse', name: 'Assamese', native: 'অসমীয়া', lang: 'pi-Beng' },
  { code: 'lana', name: 'Tai Tham', native: 'ᨲᩫ᩠ᩅᨾᩮᩬᨦ', lang: 'pi-Lana' },
  { code: 'brah', name: 'Brahmi', native: 'Brāhmī', lang: 'pi-Brah' },
  { code: 'cakm', name: 'Chakma', native: '𑄌𑄋𑄴𑄟𑄳𑄦', lang: 'pi-Cakm' },
  { code: 'java', name: 'Javanese', native: 'ꦗꦮ', lang: 'pi-Java' },
  { code: 'bali', name: 'Balinese', native: 'ᬩᬮᬶ', lang: 'pi-Bali' },
]

export const SCRIPT_CODES = SCRIPTS.map(s => s.code)
export const isScriptCode = (s: string | undefined): s is string => !!s && SCRIPT_CODES.includes(s)
export const DEFAULT_SCRIPT = 'latn'

/** v2 script codes (scripts/pali-script.js Script enum) -> ISO codes */
export const LEGACY_SCRIPT: Record<string, string> = {
  si: 'sinh', hi: 'deva', ro: 'latn', th: 'thai', lo: 'laoo', my: 'mymr', km: 'khmr', be: 'beng', as: 'asse',
  gm: 'guru', tt: 'lana', gj: 'gujr', te: 'telu', ka: 'knda', mm: 'mlym', br: 'brah', tb: 'tibt', cy: 'cyrl',
}
