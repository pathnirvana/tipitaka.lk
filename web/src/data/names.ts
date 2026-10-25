/**
 * tipitaka.app's places and people and the mūla <-> aṭṭhakathā links (the engine's links / settings / names / entity
 * operations, server/engine/names.go). Names are Roman: shown in Sinhala script with usePaliSinh().
 */
import { getData } from './source'
import type { MapPlace } from '@/map/draw'

export type EntityType = 'place' | 'person' | 'group' | 'deity' | 'animal'
export type SettingRole = 'place' | 'teacher' | 'with' | 'about'
export interface Entity {
  slug: string; type: EntityType; name: string; lemma?: string; family?: string; meaning?: string
  lat?: number; lon?: number; prec?: number; mentions: number; settings: number
}
export interface SettingRow extends Entity { role: SettingRole; source: string }
export interface SettingResult { key: string; from: '' | 'parent' | 'first'; roles: SettingRow[] }
export interface LinkTarget { key: string; file: string; page: number; entry: number; text: string; sinh: string; src: number }
export interface NodeRef { key: string; pali: string; sinh: string; role?: string; count?: number; page: number; entry: number; parentPali: string; parentSinh: string }
/** the parent of a node ref as a tree item (its title: context for titles like "1. 1. 1") */
export const parentOf = (n: NodeRef) => ({ pali: n.parentPali, sinh: n.parentSinh })
export interface Related extends Entity { role?: SettingRole; count: number }
export interface EntityPage extends Entity {
  settingNodes: NodeRef[]; mentionNodes: NodeRef[]
  related: Related[] // in the settings of the same suttas, with their role
  homonyms: Entity[] // others of the same name
  comentions: Related[] // often named in the same paragraphs
}

/**
 * a commentary lemma and the mūla words it quotes (tipitaka.app's word alignment), seen from a file: side 't' when the
 * file has the quoted words, 'c' when it has the lemma. Words are shared/tokenize numbers (data-w); spans [p:e:w ..
 * ep:ee:ew] are inclusive, the explanation in the aṭṭhakathā runs from the lemma to xp:xe:xw (exclusive)
 */
export interface Gloss {
  g: number; side: 't' | 'c'
  p: number; e: number; w: number; ep: number; ee: number; ew: number
  /** the other side: its file, the node of its start, its span */
  file: string; key: string; tp: number; te: number; tw: number; tep: number; tee: number; tew: number
  xp: number; xe: number; xw: number
  conf: number; src: string
}

export const links = (file: string, page: number, entry: number) => getData().op<LinkTarget[]>('links', { file, page, entry })
export const linkCounts = (file: string, from: number, to: number) => getData().op<Record<string, number>>('linkcounts', { file, from, to })
export const settingOf = (key: string) => getData().op<SettingResult>('settings', { key })
/** the glosses touching the pages [from, to] of a file */
export const glosses = (file: string, from: number, to: number) => getData().op<Gloss[]>('glosses', { file, from, to })
export const paraNames = (file: string, page: number, entry: number) => getData().op<Entity[]>('paranames', { file, page, entry })
export const searchNames = (q: string, types: string[] = [], limit = 200) => getData().op<Entity[]>('names', { q, limit, ...(types.length ? { types: types.join(',') } : {}) })
export const entityPage = (slug: string) => getData().op<EntityPage>('entity', { slug })

let placesCache: Promise<Entity[]> | null = null
/** the places with coordinates, the most settings first (one request per session) */
export function placesWithCoords(): Promise<Entity[]> {
  placesCache ??= getData().op<Entity[]>('places').catch(() => { placesCache = null; return [] })
  return placesCache
}

export const ROLE_LABEL: Record<SettingRole, string> = { place: 'දේශනා කළ ස්ථානය', teacher: 'දේශනා කළේ', with: 'සමඟ', about: 'අරභයා' }
export const TYPE_LABEL: Record<EntityType, string> = { place: 'ස්ථාන', person: 'පුද්ගලයන්', group: 'ජනපද හා කුල', deity: 'දෙවියන්', animal: 'සතුන්' }

/** the journeys of the base map (tipitaka.app): the sutta that tells them */
export const JOURNEYS = [
  { id: 'mahaparinibbana', key: 'dn-2-3', title: 'බුදුරජුන්ගේ අවසන් චාරිකාව (දී.නි. 16)' },
  { id: 'parayana', key: 'kn-snp-5', title: 'බාවරීගේ ශිෂ්‍යයන්ගේ ගමන (සු.නි. 5)' },
]

/** a country, kingdom, district …: an area, drawn as a region, not as a point */
export const isArea = (e: Entity) => /countries|continents|country|kingdom|district|region|province|janapada/.test(e.family ?? '')
export const hasCoords = (e: Entity) => !!e.prec && e.lat !== undefined && e.lon !== undefined
export const mapPlace = (e: Entity, kind: MapPlace['kind'], extra: Partial<MapPlace> = {}): MapPlace =>
  ({ slug: e.slug, name: e.name, lat: e.lat!, lon: e.lon!, prec: e.prec, kind, meaning: e.meaning, ...extra })

/** the big cities as faint points of orientation (not the given slugs) */
export async function contextPlaces(skip: string[] = [], n = 12): Promise<MapPlace[]> {
  const cities = (await placesWithCoords()).filter(e => e.type === 'place' && /cities/.test(e.family ?? '') && !skip.includes(e.slug))
  return cities.slice(0, n).map((e, i) => mapPlace(e, 'context', { label: i < 6 }))
}
