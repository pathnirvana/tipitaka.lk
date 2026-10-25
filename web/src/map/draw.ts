/**
 * The map of places (lazy chunk: Leaflet + the base map). No tiles are needed: the base map is drawn from
 * web/src/assets/map/basemap.json (npm run names:geo: land, rivers with their Pāḷi names, the Himavanta, the
 * mahājanapadas and two journeys of SuttaCentral's map), so it works offline in the apps. The OpenStreetMap layer
 * (today's towns and roads) is optional and needs a connection.
 * Colours are CSS variables of the theme (map.css); labels are converted to the reader's script (conv).
 */
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './map.css'
import basemap from '@/assets/map/basemap.json'
import reliefUrl from '@/assets/map/relief.jpg'
import { km } from './geo'

type LonLat = [number, number]
interface Basemap {
  bbox: { w: number; e: number; s: number; n: number }
  land: LonLat[][]; coast: LonLat[][]; borders: LonLat[][]
  rivers: { name?: string; slug?: string; rank: number; lines: LonLat[][] }[]
  mountains: { name: string; rings: LonLat[][] }[]
  regions: { name: string; slugs: string[]; kind: string; color: string; ring: LonLat[]; label: LonLat }[]
  journeys: { id: string; key: string; stops: { name: string; slug?: string; at: LonLat }[]; line: LonLat[] }[]
}
const B = basemap as unknown as Basemap

export interface MapPlace {
  slug: string; name: string; lat: number; lon: number; prec?: number
  /** main: the places of the page; related: with a count (circle size); context: other cities, small */
  kind: 'main' | 'related' | 'context'
  count?: number
  /** permanent label */
  label?: boolean
  meaning?: string
}
export type MapBase = 'drawn' | 'today' | 'satellite'
export interface JourneyInfo { id: string; key: string; stops: { name: string; slug?: string; km: number }[]; total: number }
export interface MapOptions {
  conv: (s: string) => string
  onSelect?: (slug: string) => void
  /** small maps: no zoom buttons, the wheel does not zoom */
  compact?: boolean
  /** the texts of the map in the interface language: the (i) button's label and panel (html), approximate places */
  texts?: { sources: string; sourcesHtml: string; approx: string; near: string }
}

const ll = (p: LonLat): L.LatLngTuple => [p[1], p[0]]
const MID: L.LatLngBoundsExpression = [[23.6, 79.6], [28.4, 88]] // the middle country: Kosala to Aṅga

export const journeyFor = (key: string) => B.journeys.find(j => j.key === key)?.id ?? null
export function journeyInfo(id: string): JourneyInfo | null {
  const j = B.journeys.find(x => x.id === id)
  if (!j) return null
  let total = 0
  const stops = j.stops.map((s, i) => {
    const d = i ? km({ lat: j.stops[i - 1].at[1], lon: j.stops[i - 1].at[0] }, { lat: s.at[1], lon: s.at[0] }) : 0
    total += d
    return { name: s.name, slug: s.slug, km: Math.round(d) }
  })
  return { id: j.id, key: j.key, stops, total: Math.round(total) }
}

export class PlaceMap {
  map: L.Map
  private placeLayer = L.layerGroup()
  private journeyLayer = L.layerGroup()
  private highlightLayer = L.layerGroup()
  private labels: { m: L.Marker; text: string; cls: string }[] = []
  private tiles: L.TileLayer | null = null
  private places: MapPlace[] = []
  private labelled: { m: L.CircleMarker; prio: number }[] = []
  /** Leaflet follows the window size only: the map's box also changes when the tree, the menu or the panel open or close */
  private resizer: ResizeObserver | null = null

  constructor(el: HTMLElement, private opt: MapOptions) {
    const b = B.bbox
    this.map = L.map(el, {
      zoomControl: !opt.compact, scrollWheelZoom: !opt.compact, attributionControl: true, minZoom: 4, maxZoom: 16,
      // the drawing covers the box only: the view stays inside it (no edge of the drawn land shows)
      maxBounds: [[b.s, b.w], [b.n, b.e]], maxBoundsViscosity: 1, zoomSnap: 0.25,
    })
    // the attribution shows the credits a tile layer requires; the sources of the drawing are behind (i)
    this.map.attributionControl.setPrefix(false)
    this.sources(opt.texts?.sources ?? 'Sources', opt.texts?.sourcesHtml ?? SOURCES)
    el.classList.add('tmap')
    for (const [name, z] of [['tmLand', 205], ['tmRelief', 207], ['tmBase', 210], ['tmRegions', 300], ['tmLabels', 450], ['tmJourney', 500], ['tmPlaces', 600]] as const) {
      this.map.createPane(name).style.zIndex = String(z)
    }
    this.map.getPane('tmRelief')!.classList.add('tm-relief-pane')
    this.map.getPane('tmLabels')!.style.pointerEvents = 'none'
    this.drawBase()
    this.placeLayer.addTo(this.map)
    this.journeyLayer.addTo(this.map)
    this.highlightLayer.addTo(this.map)
    const fill = () => this.map.setMinZoom(Math.max(4, this.map.getBoundsZoom([[b.s, b.w], [b.n, b.e]], true)))
    fill()
    this.map.on('resize', fill)
    let frame = 0
    this.resizer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => this.map.invalidateSize()) })
    this.resizer.observe(el)
    this.map.fitBounds(MID)
    const zoomClass = () => {
      const z = this.map.getZoom()
      el.classList.toggle('tm-far', z < 5.5)
      el.classList.toggle('tm-near', z >= 7)
    }
    this.map.on('zoomend', zoomClass)
    this.map.on('zoomend moveend', () => this.declutter())
    zoomClass()
  }

  private label(at: L.LatLngExpression, text: string, cls: string) {
    const m = L.marker(at, { pane: 'tmLabels', interactive: false, keyboard: false,
      icon: L.divIcon({ className: `tm-label ${cls}`, html: '', iconSize: undefined }) })
    this.labels.push({ m, text, cls })
    return m
  }

  private drawBase() {
    const base = { pane: 'tmBase', interactive: false }
    L.polygon(B.land.map(r => r.map(ll)), { pane: 'tmLand', interactive: false, className: 'tm-land', stroke: false }).addTo(this.map)
    this.drawRelief()
    L.polygon(B.mountains.flatMap(m => m.rings.map(r => r.map(ll))), { ...base, className: 'tm-mountain', stroke: false }).addTo(this.map)
    L.polyline(B.borders.map(l => l.map(ll)), { ...base, className: 'tm-border', weight: 1 }).addTo(this.map)
    L.polyline(B.coast.map(l => l.map(ll)), { ...base, className: 'tm-coast', weight: 1 }).addTo(this.map)
    for (const r of B.rivers) {
      L.polyline(r.lines.map(l => l.map(ll)), { ...base, className: `tm-river${r.name ? ' tm-river-named' : ''}`, weight: r.rank <= 3 ? 2.2 : r.rank <= 6 ? 1.5 : 1 })
        .addTo(this.map)
      if (r.name) {
        const longest = [...r.lines].sort((a, b) => b.length - a.length)[0]
        this.label(ll(longest[Math.floor(longest.length * 0.45)]), r.name, 'tm-river-label').addTo(this.map)
      }
    }
    for (const m of B.mountains) {
      const ring = m.rings[0]
      const c: LonLat = [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]
      this.label(ll(c), m.name, 'tm-mountain-label').addTo(this.map)
    }
    for (const r of B.regions) {
      // the mahājanapadas coloured as on SuttaCentral's map; the republics and regions dashed
      const poly = L.polygon(r.ring.map(ll), { pane: 'tmRegions', className: `tm-region tm-${r.kind}`, color: r.color, fillColor: r.color,
        weight: r.kind === 'janapada' ? 1.5 : 1.2, dashArray: r.kind === 'janapada' ? undefined : '5 4', fillOpacity: r.kind === 'janapada' ? 0.24 : 0.14,
        opacity: 0.85, interactive: r.slugs.length > 0 && !!this.opt.onSelect })
      if (r.slugs.length && this.opt.onSelect) poly.on('click', () => this.opt.onSelect!(r.slugs[0]))
      poly.addTo(this.map)
      this.label(ll(r.label), r.name, `tm-region-label tm-${r.kind}-label`).addTo(this.map)
    }
    this.renderLabels()
  }

  /**
   * the shaded relief (Natural Earth): an equirectangular image, put row by row on a canvas in the map's projection
   * (Web Mercator) so that the mountains are where the rivers are; blended over the land (map.css)
   */
  private drawRelief() {
    const img = new Image()
    img.onload = () => {
      const b = B.bbox, w = img.width
      const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
      const yN = merc(b.n), yS = merc(b.s)
      const h = Math.round((w * (yN - yS)) / (((b.e - b.w) * Math.PI) / 180))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      for (let r = 0; r < h; r++) {
        const lat = (Math.atan(Math.exp(yN - ((r + 0.5) / h) * (yN - yS))) * 360) / Math.PI - 90
        const sy = Math.min(img.height - 1, Math.max(0, Math.floor(((b.n - lat) / (b.n - b.s)) * img.height)))
        ctx.drawImage(img, 0, sy, w, 1, 0, r, w, 1)
      }
      L.imageOverlay(canvas.toDataURL('image/jpeg', 0.85), [[b.s, b.w], [b.n, b.e]], { pane: 'tmRelief', interactive: false }).addTo(this.map)
    }
    img.src = reliefUrl
  }

  /** the sources of the map behind an (i) button (none of them requires a visible credit; the tiles do: attribution) */
  private sources(label: string, html: string) {
    const Control = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: () => {
        const div = L.DomUtil.create('div', 'leaflet-control tm-sources')
        const button = L.DomUtil.create('button', 'tm-sources-button', div)
        button.type = 'button'
        button.textContent = 'i'
        button.title = label
        button.setAttribute('aria-label', label)
        button.setAttribute('aria-expanded', 'false')
        const panel = L.DomUtil.create('div', 'tm-sources-panel', div)
        panel.hidden = true
        panel.innerHTML = html
        L.DomEvent.disableClickPropagation(div)
        L.DomEvent.on(button, 'click', () => {
          panel.hidden = !panel.hidden
          button.setAttribute('aria-expanded', String(!panel.hidden))
        })
        return div
      },
    })
    new Control().addTo(this.map)
  }

  /** an approximate place (prec 3), one only known to be in or near another (prec 4) */
  private approxText(prec: number) {
    return prec >= 4 ? `≈ ${this.opt.texts?.near ?? 'in or near'}` : `≈ ${this.opt.texts?.approx ?? 'approximate'}`
  }

  /** label texts in the current script */
  renderLabels() {
    for (const { m, text, cls } of this.labels) {
      m.setIcon(L.divIcon({ className: `tm-label ${cls}`, html: `<span>${escape(this.opt.conv(text))}</span>`, iconSize: undefined }))
    }
    this.setPlaces(this.places)
  }
  setConv(conv: (s: string) => string) { this.opt.conv = conv; this.renderLabels() }

  setPlaces(places: MapPlace[]) {
    this.places = places
    this.placeLayer.clearLayers()
    this.labelled = []
    const max = Math.max(1, ...places.map(p => p.count ?? 1))
    // small ones first: the big circles stay clickable on top
    for (const p of [...places].sort((a, b) => rank(a) - rank(b) || (a.count ?? 0) - (b.count ?? 0))) {
      const r = p.kind === 'main' ? 7 : p.kind === 'context' ? 3 : 3.5 + 9 * Math.sqrt((p.count ?? 1) / max)
      const m = L.circleMarker([p.lat, p.lon], { pane: 'tmPlaces', radius: r, weight: p.kind === 'main' ? 2.5 : 1,
        className: `tm-place tm-${p.kind}${(p.prec ?? 1) >= 3 ? ' tm-approx' : ''}`, bubblingMouseEvents: false })
      const text = this.opt.conv(p.name)
      // a label is the name; hovering shows the details (a place without a label: the details only)
      const short = escape(text)
      const long = `<b>${escape(text)}</b>${p.count && p.kind !== 'main' ? ` · ${p.count}` : ''}${p.meaning ? `<br><span class="tm-tip-meaning">${escape(p.meaning)}</span>` : ''}`
        + `${(p.prec ?? 1) >= 3 ? `<br><span class="tm-tip-meaning">${escape(this.approxText(p.prec!))}</span>` : ''}`
      m.bindTooltip(p.label ? short : long, { permanent: !!p.label, direction: 'right', offset: [r, 0],
        className: `tm-tip${p.label ? ' tm-tip-label' : ''} tm-tip-${p.kind}` })
      if (p.label) {
        m.on('mouseover', () => { m.setTooltipContent(long); m.getTooltip()?.getElement()?.classList.add('tm-tip-open') })
        m.on('mouseout', () => { m.setTooltipContent(short); m.getTooltip()?.getElement()?.classList.remove('tm-tip-open'); this.declutter() })
        this.labelled.push({ m, prio: p.kind === 'main' ? 1e9 : (p.count ?? 0) })
      }
      if (this.opt.onSelect) m.on('click', () => this.opt.onSelect!(p.slug))
      m.addTo(this.placeLayer)
    }
    this.declutter()
  }

  /** hides the labels that overlap a more important one (places by their number of suttas, then the map's own
   * labels: regions, rivers, mountains) */
  declutter() {
    const taken: DOMRect[] = []
    const overlaps = (r: DOMRect) => taken.some(t => r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top)
    const place = (el: HTMLElement | undefined) => {
      if (!el) return
      el.style.visibility = ''
      const r = el.getBoundingClientRect()
      if (!r.width) return
      if (overlaps(r)) el.style.visibility = 'hidden'
      else taken.push(r)
    }
    for (const { m } of [...this.labelled].sort((a, b) => b.prio - a.prio)) place(m.getTooltip()?.getElement())
    for (const { m } of this.labels) place(m.getElement()?.firstElementChild as HTMLElement | undefined)
  }

  /** draws a journey (stops numbered); null removes it */
  setJourney(id: string | null): JourneyInfo | null {
    this.journeyLayer.clearLayers()
    const j = id ? B.journeys.find(x => x.id === id) : null
    if (!j) return null
    L.polyline(j.line.map(ll), { pane: 'tmJourney', className: 'tm-journey', weight: 3, interactive: false }).addTo(this.journeyLayer)
    j.stops.forEach((s, i) => {
      const m = L.marker(ll(s.at), { pane: 'tmJourney', icon: L.divIcon({ className: 'tm-stop', html: `<span>${i + 1}</span>`, iconSize: [18, 18] }) })
      m.bindTooltip(escape(this.opt.conv(s.name)), { direction: 'top', offset: [0, -8], className: 'tm-tip' })
      if (s.slug && this.opt.onSelect) m.on('click', () => this.opt.onSelect!(s.slug!))
      m.addTo(this.journeyLayer)
    })
    this.map.fitBounds(L.latLngBounds(j.line.map(ll)), { padding: [24, 24] })
    return journeyInfo(j.id)
  }

  hasJourney() { return this.journeyLayer.getLayers().length > 0 }

  /** outlines the region or river of a name (a janapada, a people, one of the great rivers) */
  highlight(slugs: string[]): boolean {
    this.highlightLayer.clearLayers()
    let any = false
    for (const r of B.regions.filter(x => x.slugs.some(s => slugs.includes(s)))) {
      L.polygon(r.ring.map(ll), { pane: 'tmRegions', className: 'tm-region-on', color: r.color, fillColor: r.color, fillOpacity: 0.3, weight: 2.5, interactive: false })
        .addTo(this.highlightLayer)
      any = true
    }
    for (const r of B.rivers.filter(x => x.slug && slugs.includes(x.slug))) {
      L.polyline(r.lines.map(l => l.map(ll)), { pane: 'tmJourney', className: 'tm-river-on', weight: 5, interactive: false }).addTo(this.highlightLayer)
      any = true
    }
    return any
  }
  highlightBounds(): L.LatLngBounds | null {
    const ls = this.highlightLayer.getLayers() as L.Polyline[]
    if (!ls.length) return null
    return ls.reduce((b, l) => b.extend(l.getBounds()), L.latLngBounds([]))
  }

  /** centres a place, close enough to see its surroundings */
  focusOn(lat: number, lon: number, zoom = 9) { this.map.setView([lat, lon], Math.max(this.map.getZoom(), zoom)) }

  /** shows the given places (or the highlighted region / river) */
  fit(places: { lat: number; lon: number }[], maxZoom = 9) {
    const b = L.latLngBounds(places.map(p => [p.lat, p.lon] as L.LatLngTuple))
    const h = this.highlightBounds()
    if (h) b.extend(h)
    if (!b.isValid()) return
    this.map.fitBounds(b.pad(places.length > 1 || h ? 0.15 : 0), { maxZoom, padding: [28, 28] })
    if (places.length === 1 && !h) this.map.setView([places[0].lat, places[0].lon], Math.min(maxZoom, this.opt.compact ? 6 : 7))
  }

  /**
   * the base under the places: the drawing (offline), today's map (OpenStreetMap tiles) or the satellite view
   * (Sentinel-2 cloudless 2016 by EOX, CC BY 4.0: contains modified Copernicus Sentinel data); the tiles need a
   * connection. With tiles the drawing gives way (map.css tm-online / tm-satellite).
   */
  setBase(base: MapBase) {
    this.tiles?.remove()
    this.tiles = null
    if (base === 'today') {
      this.tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, pane: 'tilePane',
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' })
    } else if (base === 'satellite') {
      this.tiles = L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg', { maxNativeZoom: 15, maxZoom: 16,
        pane: 'tilePane', attribution: '<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by EOX (Copernicus Sentinel data 2016)' })
    }
    this.tiles?.addTo(this.map)
    const el = this.map.getContainer()
    el.classList.toggle('tm-online', base !== 'drawn')
    el.classList.toggle('tm-satellite', base === 'satellite')
  }

  destroy() { this.resizer?.disconnect(); this.map.remove() }
}

/** the sources (English: PlaceMap passes them translated) */
export const SOURCES = [
  'Places, mahājanapadas, journeys: <a href="https://suttacentral.net/map" target="_blank" rel="noopener">SuttaCentral</a> (CC0) and the DPPN',
  'Coast, rivers, mountains, relief, borders: <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a> (public domain)',
  'Names: <a href="https://digitalpalidictionary.github.io" target="_blank" rel="noopener">DPD</a>, DPPN (Malalasekera, rev. Ānandajoti, CC BY-SA)',
  'Map: <a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>',
].join('<br>')

const rank = (p: MapPlace) => (p.kind === 'context' ? 0 : p.kind === 'related' ? 1 : 2)
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
