/**
 * The pilot set: the same packets for every runner, so the two experiments can be compared entry by entry.
 *
 *   npx tsx dev/apz-trans/pilot.ts [--show <packet id>]
 *
 * Writes dev/apz-trans/out/pilot/packets.json. Ranges are split into packets of about MAX_PALI Pāḷi chars at entry
 * boundaries; the packets of one range run in order, so each one gets the previous translations as PREV.
 */
import fs from 'node:fs'
import path from 'node:path'
import { OUT, entries, openDb, packet, render, type Packet } from './lib'

const MAX_PALI = 4000
const RANGES: { group: string; mode: Packet['mode']; file: string; from: string; to: string }[] = [
  { group: 'vinaya', mode: 'translate', file: 'vp-prj', from: '6:0', to: '8:4' }, // Verañja: the famine, Moggallāna, Sāriputta's question
  { group: 'abhidhamma', mode: 'translate', file: 'ap-dhs', from: '12:3', to: '12:12' }, // the first kusala citta and its dhammas
  { group: 'abhidhamma', mode: 'translate', file: 'ap-vbh', from: '0:4', to: '1:3' }, // khandhavibhaṅga: rūpakkhandha
  { group: 'qa', mode: 'qa', file: 'sn-5-4', from: '37:12', to: '37:23' }, // 6 AI fill-ins, incl. 37:20 (36 → "30")
  { group: 'qa', mode: 'qa', file: 'an-3-3', from: '12:0', to: '12:11' }, // 1 AI fill-in (12:2), the rest human APZ
  { group: 'qa', mode: 'qa', file: 'kn-ap-1-19', from: '10:0', to: '10:8' }, // 4 AI fill-ins in apadāna verses
  { group: 'qa', mode: 'qa', file: 'mn-1', from: '10:0', to: '10:4' }, // human APZ, Sabbāsava sutta
]

export interface PilotPacket extends Packet { group: string; after?: string }

const db = openDb()
const packets: PilotPacket[] = []
for (const r of RANGES) {
  const es = entries(db, r.file, r.from, r.to)
  let cur: typeof es = [], size = 0, n = 0, prevId: string | undefined
  const flush = () => {
    if (!cur.length) return
    const id = `${r.file}-${r.from.replace(':', '.')}-${++n}`
    packets.push({ ...packet(db, id, r.mode, cur), group: r.group, ...(prevId ? { after: prevId } : {}) })
    prevId = id; cur = []; size = 0
  }
  for (const e of es) {
    if (size && size + e.pali.length > MAX_PALI) flush()
    cur.push(e); size += e.pali.length
  }
  flush()
}
const dir = path.join(OUT, 'pilot')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'packets.json'), JSON.stringify(packets, null, 1))
for (const p of packets) {
  const pali = p.entries.reduce((s, e) => s + e.pali.length, 0)
  console.log(`${p.id.padEnd(22)} ${p.group.padEnd(10)} ${p.mode.padEnd(9)} ${String(p.entries.length).padStart(3)} entries ${String(pali).padStart(5)} Pāḷi chars, ` +
    `${Object.values(p.glosses).flat().length} glosses, ${p.atta.length} atta (${p.atta.reduce((s, a) => s + a.pali.length, 0)} chars), rendered ${render(p).length} chars`)
}
const show = process.argv.indexOf('--show')
if (show > 0) console.log('\n' + render(packets.find(p => p.id === process.argv[show + 1])!))
