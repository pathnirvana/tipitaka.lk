/**
 * Singlish (Sinhala typed with English letters) -> possible Sinhala words, via @pnfo/singlish-search.
 * The library ships a ~60 KB letter model (v1.3+), so it is only loaded when a Singlish query is typed.
 */
export const isSinglishQuery = (query: string) => /[A-Za-z]/.test(query) // same as the library

let lib: Promise<typeof import('@pnfo/singlish-search')> | null = null
/** ranked most likely first, at most maxMatches (library default 300) */
export async function singlishMatches(query: string, maxMatches?: number): Promise<string[]> {
  lib ??= import('@pnfo/singlish-search')
  return (await lib).getPossibleMatches(query, maxMatches ? { maxMatches } : undefined)
}
