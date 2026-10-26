import { describe, expect, it } from 'vitest'
import { Tally, deviceOf, visitFlags, weekOf } from './stats'

const r = (name: string, path: string, params: Record<string, string> = {}) => ({ name, path, params })

describe('usage counts (stats.ts)', () => {
  it('groups days into weeks starting on Monday, as the server does', () => {
    expect(weekOf('2026-10-19')).toBe('2026-10-19') // Monday
    expect(weekOf('2026-10-25')).toBe('2026-10-19') // Sunday
    expect(weekOf('2026-11-01')).toBe('2026-10-26')
  })
  it('flags the first visit of the day, week and month', () => {
    expect(visitFlags('', '2026-10-22', true)).toEqual({ new: true, day: true, week: true, month: true })
    expect(visitFlags('2026-10-22', '2026-10-22', false)).toEqual({ new: false, day: false, week: false, month: false })
    expect(visitFlags('2026-10-20', '2026-10-22', false)).toEqual({ new: false, day: true, week: false, month: false })
    expect(visitFlags('2026-10-18', '2026-10-22', false)).toEqual({ new: false, day: true, week: true, month: false })
    expect(visitFlags('2026-09-30', '2026-10-01', false)).toEqual({ new: false, day: true, week: false, month: true })
  })
  it('tells the device: operating system and phone / tablet / desktop', () => {
    const ua = {
      androidPhone: 'Mozilla/5.0 (Linux; Android 14; SM-A146P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
      androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
      iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
      windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
      linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
      chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
    }
    expect(deviceOf(ua.androidPhone, 5)).toEqual({ os: 'android', form: 'phone' })
    expect(deviceOf(ua.androidTablet, 5)).toEqual({ os: 'android', form: 'tablet' })
    expect(deviceOf(ua.iphone, 5)).toEqual({ os: 'ios', form: 'phone' })
    expect(deviceOf(ua.ipad, 5)).toEqual({ os: 'ios', form: 'tablet' }) // iPadOS asks for the desktop site as a Mac
    expect(deviceOf(ua.ipad, 0)).toEqual({ os: 'mac', form: 'desktop' })
    expect(deviceOf(ua.windows, 0)).toEqual({ os: 'windows', form: 'desktop' })
    expect(deviceOf(ua.linux, 0)).toEqual({ os: 'linux', form: 'desktop' })
    expect(deviceOf(ua.chromebook, 0)).toEqual({ os: 'chromeos', form: 'desktop' })
    expect(deviceOf('', 0)).toEqual({ os: 'other', form: 'desktop' })
  })
  it('counts pages, and only the last query of a search typed letter by letter', () => {
    const t = new Tally()
    t.route(r('Welcome', '/'))
    t.route(r('Home', '/dn-1-1'), r('Welcome', '/'))
    t.route(r('Home', '/dn-1-2'), r('Home', '/dn-1-1'))
    t.route(r('Home', '/dn-1-2'), r('Home', '/dn-1-2')) // hash only
    t.route(r('fts', '/fts/ධම', { words: 'ධම' }), r('Home', '/dn-1-2'))
    t.route(r('fts', '/fts/ධම්ම', { words: 'ධම්ම' }), r('fts', '/fts/ධම'))
    t.route(r('fts', '/fts/සති', { words: 'සති' }), r('fts', '/fts/ධම්ම')) // a new search
    t.route(r('title', '/title/metta', { term: 'metta' }), r('fts', '/fts/සති'))
    expect(t.take()).toEqual({ pages: { Welcome: 1, Home: 2, fts: 1, title: 1 }, terms: [['fts', 'ධම්ම'], ['fts', 'සති'], ['title', 'metta']] })
    expect(t.take()).toBeNull()
  })
  it('counts the requests to the server, the features and the words tapped in texts (in Sinhala letters)', () => {
    const t = new Tally()
    t.op('meta.info', {})
    t.op('text.entries', { file: 'dn-1' })
    t.op('text.entries', { file: 'dn-2' })
    t.op('lookup', { w: 'dhammo' })
    t.feature('audio')
    expect(t.take()).toEqual({ ops: { 'text.entries': 2, lookup: 1 }, features: { audio: 1 }, words: ['ධම්මො'] })
  })
})
