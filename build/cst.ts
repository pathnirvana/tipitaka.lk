/**
 * tipitaka.app's data in text.db through the entry -> CST paragraph map (dev/cst-map/<file>.json, made by
 * dev/cst-map/map.ts; a record is used while its ph matches the entry's Pāḷi text) and the export dev/cst-data/:
 *   entry_link     mūla entry <-> aṭṭhakathā entry (the commentary of a paragraph)
 *   entity         places, people ... (names in Roman: the web app shows them in Sinhala script)
 *   node_setting   the setting (place, teacher, with, about) of a sutta / story node
 *   entry_mention  the names in an entry
 *   gloss          word level: an aṭṭhakathā lemma (entry, word .. entry, word), the mūla words it quotes and the last word
 *                  of its explanation; words are shared/tokenize numbers (placed through the map's word runs)
 *   comention      names often named in the same entries (tipitaka.app's rule)
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type Database from 'better-sqlite3'
import { fold } from '../shared/normalize'

export const CST_MAP_DIR = 'dev/cst-map', CST_DATA_DIR = 'dev/cst-data'
/** lk's Sinhala translations of the names' English descriptions and categories (dev/names-si/translate.ts) */
export const NAMES_SI_DIR = 'dev/names-si'

export const CST_SCHEMA = `
CREATE TABLE entry_link (mula INTEGER NOT NULL, atta INTEGER NOT NULL, src INTEGER NOT NULL, PRIMARY KEY (mula, atta)) WITHOUT ROWID;
CREATE INDEX entry_link_atta ON entry_link(atta, mula);
CREATE TABLE entity (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, type TEXT NOT NULL, name TEXT NOT NULL, name_fold TEXT NOT NULL,
  lemma TEXT NOT NULL, family TEXT NOT NULL, meaning TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, prec INTEGER NOT NULL,
  mentions INTEGER NOT NULL, settings INTEGER NOT NULL, meaning_en TEXT NOT NULL, family_en TEXT NOT NULL);
CREATE INDEX entity_fold ON entity(name_fold);
CREATE TABLE node_setting (node_id INTEGER NOT NULL, entity_id INTEGER NOT NULL, role TEXT NOT NULL, ord INTEGER NOT NULL,
  source TEXT NOT NULL, conf REAL NOT NULL, listed INTEGER NOT NULL, PRIMARY KEY (node_id, role, entity_id)) WITHOUT ROWID;
CREATE INDEX node_setting_entity ON node_setting(entity_id, node_id);
CREATE TABLE entry_mention (entry_id INTEGER NOT NULL, entity_id INTEGER NOT NULL, amb INTEGER NOT NULL, PRIMARY KEY (entry_id, entity_id)) WITHOUT ROWID;
CREATE INDEX entry_mention_entity ON entry_mention(entity_id, entry_id);
CREATE TABLE gloss (id INTEGER PRIMARY KEY, conf REAL NOT NULL, src TEXT NOT NULL, a_entry INTEGER NOT NULL, a_w INTEGER NOT NULL,
  a_eentry INTEGER NOT NULL, a_ew INTEGER NOT NULL, x_entry INTEGER NOT NULL, x_w INTEGER NOT NULL,
  m_entry INTEGER NOT NULL, m_w INTEGER NOT NULL, m_eentry INTEGER NOT NULL, m_ew INTEGER NOT NULL);
CREATE INDEX gloss_a ON gloss(a_entry);
CREATE INDEX gloss_ae ON gloss(a_eentry);
CREATE INDEX gloss_m ON gloss(m_entry);
CREATE INDEX gloss_me ON gloss(m_eentry);
CREATE TABLE comention (entity_id INTEGER NOT NULL, other_id INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (entity_id, other_id)) WITHOUT ROWID;
`

type MapRecord = [string, number, string, string?]
const textHash = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12)
const readTsv = (file: string) => {
  const [head, ...lines] = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean)
  const cols = head.split('\t')
  return lines.map(l => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v])) as Record<string, string>)
}

export class CstData {
  readonly maps = new Map<string, Record<string, MapRecord>>() // file -> "page:entry" -> [ph, conf, paras, word runs (lk-cst/2)]
  readonly hash: string // part of api_hash
  readonly available: boolean
  constructor(readonly mapDir = CST_MAP_DIR, readonly dataDir = CST_DATA_DIR) {
    const h = crypto.createHash('sha1')
    this.available = fs.existsSync(path.join(dataDir, 'links.tsv'))
    if (fs.existsSync(mapDir)) for (const n of fs.readdirSync(mapDir).filter(n => n.endsWith('.json')).sort()) {
      const raw = fs.readFileSync(path.join(mapDir, n), 'utf-8')
      h.update(raw)
      this.maps.set(n.slice(0, -5), (JSON.parse(raw) as { entries: Record<string, MapRecord> }).entries)
    }
    if (this.available) for (const n of ['links.tsv', 'entities.tsv', 'settings.tsv', 'mentions.tsv', 'glosses.tsv']) {
      if (fs.existsSync(path.join(dataDir, n))) h.update(fs.readFileSync(path.join(dataDir, n)))
    }
    for (const n of ['meanings.tsv', 'families.tsv']) if (fs.existsSync(path.join(NAMES_SI_DIR, n))) h.update(fs.readFileSync(path.join(NAMES_SI_DIR, n)))
    this.hash = h.digest('hex').slice(0, 12)
  }

  /** fills the tables; returns the build report lines */
  write(db: Database.Database): string[] {
    db.exec(CST_SCHEMA)
    if (!this.available) return ['## tipitaka.app data', '', 'dev/cst-data missing: no commentary links, places or people.', '']
    // CST paragraph -> lk entries (fresh map records only)
    const entries = db.prepare(`SELECT e.id, f.name AS file, e.page_idx, e.entry_idx, e.p_text, IFNULL(e.node_id, 0) AS node_id
      FROM entry e JOIN file f ON f.id = e.file_id`).all() as { id: number; file: string; page_idx: number; entry_idx: number; p_text: string; node_id: number }[]
    const byPara = new Map<string, number[]>()
    const runsOf = new Map<string, WordRun[]>() // CST paragraph -> lk words
    const nodeOf = new Map<number, number>()
    let fresh = 0, stale = 0
    for (const e of entries) {
      nodeOf.set(e.id, e.node_id)
      const rec = this.maps.get(e.file)?.[`${e.page_idx}:${e.entry_idx}`]
      if (!rec) continue
      if (rec[0] !== textHash(e.p_text)) { stale++; continue }
      fresh++
      for (const p of rec[2].split(' ')) { const l = byPara.get(p); if (l) l.push(e.id); else byPara.set(p, [e.id]) }
      if (rec[3]) for (const r of rec[3].split(';')) {
        const [lkW, para, cstW, len] = r.split(' ')
        const run: WordRun = { cstW: Number(cstW), len: Number(len), entry: e.id, lkW: Number(lkW) }
        const l = runsOf.get(para)
        if (l) l.push(run); else runsOf.set(para, [run])
      }
    }
    for (const l of runsOf.values()) l.sort((a, b) => a.cstW - b.cstW)
    const lk = (book: string, idx: string | number) => byPara.get(`${book}#${idx}`) ?? []

    // commentary links: lk mūla entries of the mūla paragraph x lk aṭṭhakathā entries of the aṭṭhakathā paragraph
    const insLink = db.prepare('INSERT OR IGNORE INTO entry_link VALUES (?, ?, ?)')
    let links = 0
    for (const l of readTsv(path.join(this.dataDir, 'links.tsv'))) {
      const ms = lk(l.mula_book, l.mula_idx), as = lk(l.atta_book, l.atta_idx)
      if (ms.length * as.length > 64) continue // (a paragraph mapped too widely: no link rather than many wrong ones)
      for (const m of ms) for (const a of as) links += insLink.run(m, a, l.source === 'paranum' ? 1 : 2).changes
    }

    // entities: the meaning and category in Sinhala where translated (the English kept in meaning_en, family_en)
    const ents = readTsv(path.join(this.dataDir, 'entities.tsv'))
    const si = (n: string) => new Map(fs.existsSync(path.join(NAMES_SI_DIR, n)) ? readTsv(path.join(NAMES_SI_DIR, n)).map(r => [r.en, r.si]) : [])
    const meaningSi = si('meanings.tsv'), familySi = si('families.tsv')
    let translated = 0
    const entityId = new Map(ents.map((e, i) => [e.slug, i + 1]))
    const insEnt = db.prepare('INSERT INTO entity VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    ents.forEach((e, i) => {
      const meaning = meaningSi.get(e.meaning) ?? e.meaning
      if (!e.meaning || meaningSi.has(e.meaning)) translated++
      insEnt.run(i + 1, e.slug, e.type, e.name, fold(e.name), e.lemma, familySi.get(e.family) ?? e.family, meaning,
        e.lat ? Number(e.lat) : 0, e.lon ? Number(e.lon) : 0, e.prec ? Number(e.prec) : 0, 0, 0, e.meaning, e.family)
    })

    // settings: the lk nodes most of the unit's entries belong to
    const insSet = db.prepare('INSERT OR IGNORE INTO node_setting VALUES (?, ?, ?, ?, ?, ?, ?)')
    let settings = 0, unplaced = 0
    for (const s of readTsv(path.join(this.dataDir, 'settings.tsv'))) {
      const count = new Map<number, number>()
      for (let i = Number(s.para_start); i < Number(s.para_end); i++) for (const e of lk(s.book, i)) { const n = nodeOf.get(e)!; if (n) count.set(n, (count.get(n) ?? 0) + 1) }
      const max = Math.max(0, ...count.values())
      if (!max) { unplaced++; continue }
      for (const [node, n] of count) if (n >= Math.max(1, 0.25 * max)) settings += insSet.run(node, entityId.get(s.slug), s.role, Number(s.ord), s.source, Number(s.conf), Number(s.listed)).changes
    }

    // names in the entries
    const insMen = db.prepare('INSERT OR IGNORE INTO entry_mention VALUES (?, ?, ?)')
    let mentions = 0
    for (const m of readTsv(path.join(this.dataDir, 'mentions.tsv'))) {
      const id = entityId.get(m.slug)
      if (id) for (const e of lk(m.book, m.idx)) mentions += insMen.run(e, id, Number(m.amb)).changes
    }
    // glosses: CST words -> lk words through the runs
    const insGloss = db.prepare('INSERT INTO gloss VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    let glosses = 0, glossTotal = 0, glossFar = 0
    const fileOf = new Map((db.prepare('SELECT id, file_id FROM entry').all() as { id: number; file_id: number }[]).map(r => [r.id, r.file_id]))
    const near = (s: WordPos, e: WordPos, cstParas: number) => fileOf.get(s.entry) === fileOf.get(e.entry) && e.entry - s.entry <= cstParas + 3
    const glossFile = path.join(this.dataDir, 'glosses.tsv')
    if (fs.existsSync(glossFile)) for (const g of readTsv(glossFile)) {
      glossTotal++
      const a = place(runsOf, `${g.a_book}#${g.a_idx}`, +g.a_w, false), ae = place(runsOf, `${g.a_book}#${g.a_eidx}`, +g.a_ew, true)
      const m = place(runsOf, `${g.m_book}#${g.m_idx}`, +g.m_w, false), me = place(runsOf, `${g.m_book}#${g.m_eidx}`, +g.m_ew, true)
      if (!a || !ae || !m || !me || before(ae, a) || before(me, m)) continue
      // both ends in one lk file, as far apart as in CST: a paragraph matched in several places of lk can place its
      // ends far apart (2026-10: 339 glosses from one file to another, which underlined whole suttas)
      if (!near(a, ae, +g.a_eidx - +g.a_idx) || !near(m, me, +g.m_eidx - +g.m_idx)) { glossFar++; continue }
      // the end of the explanation: its last word, else the last placed word of a paragraph before it (not before the lemma)
      let x = place(runsOf, `${g.a_book}#${g.x_idx}`, +g.x_w, true, 50)
      for (let i = +g.x_idx - 1; !x && i >= +g.a_eidx; i--) x = place(runsOf, `${g.a_book}#${i}`, Infinity, true, Infinity)
      if (!x || before(x, ae)) x = ae
      glosses += insGloss.run(+g.id, +g.conf, g.src, a.entry, a.w, ae.entry, ae.w, x.entry, x.w, m.entry, m.w, me.entry, me.w).changes
    }

    // names named together: per entry with 2-30 names (long lists say little about each other), the 40 most frequent
    // others of each name, named together more than once (tipitaka.app write-db.ts)
    const byEntry = new Map<number, number[]>()
    for (const r of db.prepare('SELECT entry_id, entity_id FROM entry_mention').all() as { entry_id: number; entity_id: number }[]) {
      const l = byEntry.get(r.entry_id); if (l) l.push(r.entity_id); else byEntry.set(r.entry_id, [r.entity_id])
    }
    const pairs = new Map<number, Map<number, number>>()
    for (const set of byEntry.values()) {
      if (set.length < 2 || set.length > 30) continue
      for (const a of set) {
        const m = pairs.get(a) ?? new Map<number, number>()
        pairs.set(a, m)
        for (const b of set) if (a !== b) m.set(b, (m.get(b) ?? 0) + 1)
      }
    }
    const insCo = db.prepare('INSERT INTO comention VALUES (?, ?, ?)')
    for (const [a, m] of pairs) for (const [b, n] of [...m].sort((x, y) => y[1] - x[1]).slice(0, 40)) if (n > 1) insCo.run(a, b, n)
    db.exec(`UPDATE entity SET mentions = (SELECT count(*) FROM entry_mention m WHERE m.entity_id = entity.id),
      settings = (SELECT count(*) FROM node_setting s WHERE s.entity_id = entity.id)`)
    return ['## tipitaka.app data (commentary links, places and people)', '',
      `- entries mapped to CST paragraphs: ${fresh} (stale, text changed since mapping: ${stale} - rerun dev/cst-map/map.ts)`,
      `- mūla <-> aṭṭhakathā entry links: ${links}`, `- entities: ${ents.length} (meanings in Sinhala: ${translated}), settings of nodes: ${settings} (units not placed: ${unplaced}), mentions: ${mentions}`,
      `- glosses (aṭṭhakathā lemma -> mūla words): ${glosses} of ${glossTotal} placed (${glossFar} dropped: their ends placed far apart)`, '']
  }
}

interface WordRun { cstW: number; len: number; entry: number; lkW: number }
interface WordPos { entry: number; w: number }
const before = (a: WordPos, b: WordPos) => a.entry < b.entry || (a.entry === b.entry && a.w < b.w) // (entry ids are in reading order)
/**
 * the lk word of a CST paragraph's word: the run that has it; a word between two runs of one entry (a variant reading:
 * lk has other words there) is the word at the same distance in lk's gap; else a start is the next matched word, an end
 * the previous one, at most `near` words away
 */
function place(runsOf: Map<string, WordRun[]>, para: string, w: number, end: boolean, near = 8): WordPos | null {
  const runs = runsOf.get(para)
  if (!runs) return null
  let prev: WordRun | null = null, next: WordRun | null = null
  for (const r of runs) {
    if (w >= r.cstW && w < r.cstW + r.len) return { entry: r.entry, w: r.lkW + w - r.cstW }
    if (r.cstW + r.len <= w) prev = r
    else if (r.cstW > w) { next = r; break }
  }
  if (prev && next && prev.entry === next.entry) {
    const lkFrom = prev.lkW + prev.len, lkTo = next.lkW // lk's words between the runs: [lkFrom, lkTo)
    if (lkTo > lkFrom) return { entry: prev.entry, w: Math.min(lkTo - 1, lkFrom + w - (prev.cstW + prev.len)) }
  }
  if (!end && next && next.cstW - w <= near) return { entry: next.entry, w: next.lkW }
  if (end && prev && w - (prev.cstW + prev.len - 1) <= near) return { entry: prev.entry, w: prev.lkW + prev.len - 1 }
  return null
}
