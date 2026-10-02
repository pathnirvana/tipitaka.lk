/** recitation audio (v2 store/audio.js). Label files: "start\tend\tnum" per line (Audacity labels). */
import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import { getData, getStatic } from '@/data/source'
import type { AudioEntryRow } from '@/data/types'
import type { EInd } from '@shared/routes'

export const AUDIO_BASE_URL = 'https://sajjha.sgp1.cdn.digitaloceanspaces.com/original/'
export interface Label { start: number; end: number; num: number; src: string }
export interface AudioEntry extends AudioEntryRow { label?: Label }

export function parseLabels(text: string, src: string): Label[] {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
    const [start, end, num] = line.split('\t').map(Number)
    return { start, end, num, src }
  }).filter(l => !isNaN(l.start) && !isNaN(l.end))
}

/** assigns labels to the playable entries. Only integer label numbers are used (v2 behaviour, A20) */
export function assignLabels(entries: AudioEntryRow[], labelLists: Label[][]): AudioEntry[] {
  const labels: Label[] = []
  for (const l of labelLists.flat()) if (Number.isInteger(l.num) && l.num > 0) labels[l.num - 1] = l
  return entries.map(e => ({ ...e, label: labels[e.audio_idx] }))
}

export const useAudio = defineStore('audio', () => {
  const audio = typeof Audio !== 'undefined' ? new Audio() : null
  const fileMap = shallowRef<Record<string, string[]>>({})
  const entries = shallowRef<AudioEntry[]>([])
  const file = ref('')
  const curEntryInd = ref(-1)
  const controlsVisible = ref(false)
  const isPlaying = ref(false)
  const duration = ref(0)
  const currentTime = ref(0)
  const currentSrc = ref('')
  const playbackRate = ref(1)
  const silenceGap = ref(0.2)

  if (audio) {
    audio.onplay = () => { isPlaying.value = true }
    audio.onerror = audio.onpause = audio.onended = () => { isPlaying.value = false }
    audio.ondurationchange = () => { duration.value = audio.duration }
    audio.ontimeupdate = () => timeUpdated(audio.currentTime)
  }

  async function init() {
    try { fileMap.value = Object.freeze(await getStatic<Record<string, string[]>>('static/data/file-map.json')) } catch { /* audio unavailable */ }
  }
  const isAvailable = (f?: string) => !!f && !!fileMap.value[f]
  const activeEntry = computed(() => entries.value[curEntryInd.value])
  const playingPos = computed(() => (isPlaying.value && activeEntry.value ? `${file.value}:${activeEntry.value.page_idx}-${activeEntry.value.entry_idx}` : ''))

  async function loadFile(f: string) {
    if (file.value === f) return
    const labelFiles = fileMap.value[f] || []
    const [rows, lists] = await Promise.all([
      getData().query<AudioEntryRow>('audio.entries', { file: f }),
      Promise.all(labelFiles.map(async lf => {
        const res = await fetch(AUDIO_BASE_URL + lf + '.txt')
        return parseLabels(await res.text(), AUDIO_BASE_URL + lf + '.m4a')
      })),
    ])
    entries.value = Object.freeze(assignLabels(rows, lists)) as AudioEntry[]
    file.value = f
  }

  async function startEntry(f: string, eInd: EInd) {
    if (!isAvailable(f)) return
    await loadFile(f)
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

  const move = (inc: number) => updateAudio(curEntryInd.value + inc, inc)
  function togglePlay() {
    if (!audio || !audio.src) return
    if (isPlaying.value) audio.pause()
    else audio.play().catch(() => {})
  }
  function pause() { audio?.pause() }
  function close() { pause(); controlsVisible.value = false }
  function setRate(r: number) { playbackRate.value = r; if (audio) audio.playbackRate = r }

  return { fileMap, entries, file, curEntryInd, controlsVisible, isPlaying, duration, currentTime, playbackRate, silenceGap,
    activeEntry, playingPos, init, isAvailable, startEntry, move, togglePlay, pause, close, setRate }
})
