declare module '@pnfo/singlish-search' {
  export function getPossibleMatches(input: string, opts?: { maxMatches?: number }): string[]
  export function isSinglishQuery(query: string): boolean
}
declare module 'intersection-observer'
declare module '@pnfo/pali-converter' {
  export const Script: Record<string, string>
  export function convert(text: string, toScript: string, fromScript: string, options?: Record<string, unknown>): string
  export function convertMixed(text: string, toScript: string, options?: Record<string, unknown>): string
  export function getScriptForCode(charCode: number): string | -1
}
