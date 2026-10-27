/**
 * recitation audio (v2 store/audio.js). Timing files on the CDN, next to each recording <label>.m4a:
 *   <label>.json   the recording's chanted paragraphs and word timings (bjt-audio audit tool), matched to the text by hash
 *   <label>.txt    before that: Audacity labels "start\tend\tnum" (num n = chanted entry n-1), + optional <label>.words.json
 */
import { defineStore } from 'pinia'
import { useUi } from './ui'
import { ref, shallowRef, computed } from 'vue'
import { getData, getStatic, isStoreApp } from '@/data/source'
import type { AudioEntryRow } from '@/data/types'
import type { EInd } from '@shared/routes'
import { countFeature } from '@/composables/stats'

export const AUDIO_BASE_URL = 'https://sajjha.sgp1.cdn.digitaloceanspaces.com/original/'
export interface Label { start: number; end: number; num: number; src: string }
/** word timings of one chanted entry: pali word index (shared/tokenize.ts) and start times in media seconds, in order */
export interface WordTimes { ph: string; w: number[]; s: number[] }
export interface AudioEntry extends AudioEntryRow { label?: Label; words?: WordTimes }

export function parseLabels(text: string, src: string): Label[] {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
    const [start, end, num] = line.split('\t').map(Number)
    return { start, end, num, src }
  }).filter(l => !isNaN(l.start) && !isNaN(l.end))
}

/**
 * <label>.words.json (made by forced alignment, next to <label>.txt on the CDN):
 * {"v":1,"tok":"v1","entries":{"<label num>":{"ph":"<sha1-12 of the pali text>","t":"<word>:<start>-<end>,..."}}}
 * times in centiseconds from the label start. Returns label num -> times in media seconds.
 */
export function parseWordTimes(doc: unknown, labels: Label[]): Map<number, WordTimes> {
  const out = new Map<number, WordTimes>()
  const d = doc as { v?: number; tok?: string; entries?: Record<string, { ph: string; t: string }> } | null
  if (!d || d.v !== 1 || d.tok !== 'v1' || !d.entries) return out
  const start = new Map(labels.map(l => [l.num, l.start]))
  for (const [num, e] of Object.entries(d.entries)) {
    const base = start.get(Number(num))
    if (base === undefined || !e.t) continue
    const times = parseTimes(e.ph, e.t, base)
    if (times) out.set(Number(num), times)
  }
  return out
}

/** "<word>:<start>-<end>,..." (centiseconds from base seconds) -> word timings in media seconds */
export function parseTimes(ph: string, t: string, base: number): WordTimes | undefined {
  const w: number[] = [], s: number[] = []
  for (const part of t.split(',')) {
    const m = part.match(/^(\d+):(\d+)-\d+$/)
    if (m) { w.push(+m[1]); s.push(base + +m[2] / 100) }
  }
  return w.length ? { ph, w, s } : undefined
}

/**
 * <label>.json: {"v":2,"tok":"v1","audio":"<label>.m4a","dur":<sec>,"entries":[{"ph","s","e","t"?}]}
 * the recording's chanted paragraphs in order: ph = sha1-12 of the pali text (entry.audio_ph), s/e centiseconds of the
 * recording, t word timings in centiseconds from s (only paragraphs that passed the aligner's checks)
 */
export interface TimingDoc { v: 2; tok: 'v1'; audio: string; dur: number; entries: { ph: string; s: number; e: number; t?: string }[] }
export const isTimingDoc = (d: unknown): d is TimingDoc =>
  !!d && (d as TimingDoc).v === 2 && (d as TimingDoc).tok === 'v1' && Array.isArray((d as TimingDoc).entries)

/**
 * pairs [text i, audio j, kind] of two hash sequences in order. 'eq' same text; 'sub' one changed paragraph on both
 * sides (plays without word timings). Unpaired text paragraphs have no audio; unpaired audio paragraphs are no longer in
 * the text. Same rule as bjt-audio scripts/timing.py match().
 */
export function matchEntries(textPh: string[], audioPh: string[], window = 20): [number, number, 'eq' | 'sub'][] {
  const out: [number, number, 'eq' | 'sub'][] = []
  let i = 0, j = 0
  const ahead = (seq: string[], from: number, x: string) => { for (let k = 1; k <= window && from + k < seq.length; k++) if (seq[from + k] === x) return k; return 0 }
  while (i < textPh.length && j < audioPh.length) {
    if (textPh[i] === audioPh[j]) { out.push([i++, j++, 'eq']); continue }
    const da = ahead(audioPh, j, textPh[i]), dt = ahead(textPh, i, audioPh[j])
    if (!da && !dt) out.push([i++, j++, 'sub'])
    else if (!dt || (da && da <= dt)) j += da
    else i += dt
  }
  return out
}

/** assigns the recordings' paragraphs (v2 timing files of the text file, in file-map order) to the playable entries */
export function assignTimings(entries: AudioEntryRow[], recordings: { src: string; doc: TimingDoc }[]): AudioEntry[] {
  const items = recordings.flatMap(r => r.doc.entries.map(e => ({ ...e, src: r.src })))
  const out: AudioEntry[] = entries.map(e => ({ ...e }))
  for (const [i, j, kind] of matchEntries(entries.map(e => e.audio_ph ?? ''), items.map(x => x.ph))) {
    const it = items[j]
    if (it.e <= it.s) continue // placeholder without audio
    const label = { start: it.s / 100, end: it.e / 100, num: entries[i].audio_idx + 1, src: it.src }
    out[i] = { ...out[i], label, words: kind === 'eq' && it.t ? parseTimes(it.ph, it.t, label.start) : undefined }
  }
  return out
}

/** index of the word being chanted at media time t (the last word started), -1 before the first */
export function wordAt(times: WordTimes, t: number): number {
  let lo = 0, hi = times.s.length - 1, ans = -1
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (times.s[mid] <= t) { ans = mid; lo = mid + 1 } else hi = mid - 1 }
  return ans < 0 ? -1 : times.w[ans]
}

/** assigns labels to the playable entries. Only integer label numbers are used (v2 behaviour, A20) */
export function assignLabels(entries: AudioEntryRow[], labelLists: Label[][], words?: Map<number, WordTimes>): AudioEntry[] {
  const labels: Label[] = []
  for (const l of labelLists.flat()) if (Number.isInteger(l.num) && l.num > 0) labels[l.num - 1] = l
  return entries.map(e => ({ ...e, label: labels[e.audio_idx], words: labels[e.audio_idx] && words?.get(labels[e.audio_idx].num) }))
}

export const useAudio = defineStore('audio', () => {
  const audio = typeof Audio !== 'undefined' ? new Audio() : null
  const fileMap = shallowRef<Record<string, string[]>>({})
  const entries = shallowRef<AudioEntry[]>([])
  const file = ref('')
  const tabUid = ref(0) // the tab the recitation was started from (its tab shows a speaker icon while playing)
  const curEntryInd = ref(-1)
  const controlsVisible = ref(false)
  const isPlaying = ref(false)
  const duration = ref(0)
  const currentTime = ref(0)
  const currentSrc = ref('')
  const playbackRate = ref(1)
  const silenceGap = ref(0.2)
  const playingWord = ref(-1) // pali word index (shared/tokenize.ts) being chanted in the active entry, -1 when unknown

  if (audio) {
    audio.onplay = () => { isPlaying.value = true; followWords() }
    audio.onerror = audio.onpause = audio.onended = () => { isPlaying.value = false; playingWord.value = -1 }
    audio.ondurationchange = () => { duration.value = audio.duration }
    audio.ontimeupdate = () => timeUpdated(audio.currentTime)
  }

  async function init() {
    try { fileMap.value = Object.freeze(await getStatic<Record<string, string[]>>('static/data/file-map.json')) } catch { /* audio unavailable */ }
  }
  const isAvailable = (f?: string) => !!f && !!fileMap.value[f]
  const activeEntry = computed(() => entries.value[curEntryInd.value])
  const playingPos = computed(() => (isPlaying.value && activeEntry.value ? `${file.value}:${activeEntry.value.page_idx}-${activeEntry.value.entry_idx}` : ''))

  /** a timing file (<label>.json, .txt, .words.json), null when there is none: the CDN allows only the website's origins,
   * so the apps (app://, file://) and the desktop app (Wails: wails://, wails.localhost) get it through the engine */
  async function timingFile(name: string): Promise<string | null> {
    const viaEngine = isStoreApp()
    try {
      if (viaEngine) return await getData().op<string>('audio', { f: name })
      const r = await fetch(AUDIO_BASE_URL + name)
      return r.ok ? await r.text() : null
    } catch { return null }
  }
  const timingJson = async (name: string) => { const t = await timingFile(name); try { return t === null ? null : JSON.parse(t) } catch { return null } }

  async function loadFile(f: string) {
    if (file.value === f) return
    const labelFiles = fileMap.value[f] || []
    const [rows, docs] = await Promise.all([
      getData().query<AudioEntryRow>('audio.entries', { file: f }),
      Promise.all(labelFiles.map(lf => timingJson(lf + '.json'))),
    ])
    if (rows.length && rows.every(r => r.audio_ph) && docs.length && docs.every(isTimingDoc)) {
      entries.value = Object.freeze(assignTimings(rows, docs.map((doc, i) => ({ src: AUDIO_BASE_URL + labelFiles[i] + '.m4a', doc })))) as AudioEntry[]
      file.value = f
      return
    }
    // timing files before v2 (or a db without audio_ph): Audacity labels by number
    const lists = await Promise.all(labelFiles.map(async lf => {
      const [txt, words] = await Promise.all([
        timingFile(lf + '.txt'),
        // word timings are optional: without them the whole paragraph is highlighted as before
        timingJson(lf + '.words.json'),
      ])
      const labels = parseLabels(txt ?? '', AUDIO_BASE_URL + lf + '.m4a')
      return { labels, words: parseWordTimes(words, labels) }
    }))
    const words = new Map(lists.flatMap(l => [...l.words]))
    entries.value = Object.freeze(assignLabels(rows, lists.map(l => l.labels), words)) as AudioEntry[]
    file.value = f
  }

  async function startEntry(f: string, eInd: EInd, fromTab = 0) {
    if (!isAvailable(f)) return
    countFeature('audio')
    tabUid.value = fromTab
    try {
      await loadFile(f)
    } catch (e) {
      // e.g. no network, or the CDN refusing the page's origin (it allows tipitaka.lk and http://localhost:8400 only)
      useUi().notify('සජ්ඣායනය ලබාගත නොහැක. අන්තර්ජාල සම්බන්ධතාවය පරීක්‍ෂා කරන්න.', 4000)
      console.error('recitation', f, e)
      return
    }
    controlsVisible.value = true
    const i = entries.value.findIndex(e => e.page_idx > eInd[0] || (e.page_idx === eInd[0] && e.entry_idx >= eInd[1]))
    updateAudio(i >= 0 ? i : 0, 1)
  }

  function updateAudio(newInd: number, dir: number) {
    const es = entries.value
    if (newInd < 0 || es.length <= newInd) return
    while (!es[newInd].label) {
      newInd += dir
      if (newInd < 0 || es.length <= newInd) return
    }
    const label = es[newInd].label!
    if (!audio) return
    audio.pause()
    if (currentSrc.value !== label.src) audio.src = currentSrc.value = label.src
    audio.currentTime = label.start
    audio.playbackRate = playbackRate.value
    curEntryInd.value = newInd
    audio.play().catch(() => { isPlaying.value = false })
  }

  function timeUpdated(t: number) {
    const es = entries.value
    const i = es.findIndex(e => e.label && currentSrc.value === e.label.src && t <= e.label.end)
    if (i >= 0 && i !== curEntryInd.value) {
      const label = es[i].label!
      if (audio && t < label.start - silenceGap.value) audio.currentTime = t = label.start - silenceGap.value // skip silence
      curEntryInd.value = i
    }
    currentTime.value = t
  }

  // the chanted word: timeupdate fires only every ~250 ms, so follow the media time every animation frame while playing
  let raf = 0
  function followWords() {
    cancelAnimationFrame(raf)
    const step = () => {
      if (!audio || !isPlaying.value) { playingWord.value = -1; return }
      const words = activeEntry.value?.words, label = activeEntry.value?.label
      const t = audio.currentTime
      const w = words && label && label.src === currentSrc.value && t <= label.end + 0.3 ? wordAt(words, t) : -1
      if (w !== playingWord.value) playingWord.value = w
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
  }

  const move = (inc: number) => updateAudio(curEntryInd.value + inc, inc)
  function togglePlay() {
    if (!audio || !audio.src) return
    if (isPlaying.value) audio.pause()
    else audio.play().catch(() => {})
  }
  function pause() { audio?.pause() }
  function close() { pause(); controlsVisible.value = false }
  function setRate(r: number) { playbackRate.value = r; if (audio) audio.playbackRate = r }

  return { fileMap, entries, file, tabUid, curEntryInd, controlsVisible, isPlaying, duration, currentTime, playbackRate, silenceGap,
    playingWord, activeEntry, playingPos, init, isAvailable, startEntry, move, togglePlay, pause, close, setRate }
})
