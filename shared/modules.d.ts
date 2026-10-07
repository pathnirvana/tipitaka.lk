declare module '@pnfo/singlish-search' {
  export function getPossibleMatches(input: string, opts?: { maxMatches?: number }): string[]
  export function isSinglishQuery(query: string): boolean
}
declare module 'intersection-observer'
