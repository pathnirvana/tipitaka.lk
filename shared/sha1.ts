/** synchronous SHA-1 of a string's UTF-8 bytes, as hex (crypto.subtle is async and needs a secure context, the apps may not have one) */
export function sha1(str: string): string {
  const bytes = new TextEncoder().encode(str)
  const len = bytes.length, words = new Uint32Array((((len + 8) >> 6) + 1) * 16)
  for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8)
  words[len >> 2] |= 0x80 << (24 - (len % 4) * 8)
  words[words.length - 1] = len * 8 // strings here are far below 512 MB, so the high length word stays 0
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0
  const w = new Uint32Array(80)
  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n))
  for (let b = 0; b < words.length; b += 16) {
    for (let t = 0; t < 16; t++) w[t] = words[b + t]
    for (let t = 16; t < 80; t++) w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1)
    let a = h0, bb = h1, c = h2, d = h3, e = h4
    for (let t = 0; t < 80; t++) {
      const f = t < 20 ? (bb & c) | (~bb & d) : t < 40 ? bb ^ c ^ d : t < 60 ? (bb & c) | (bb & d) | (c & d) : bb ^ c ^ d
      const k = t < 20 ? 0x5a827999 : t < 40 ? 0x6ed9eba1 : t < 60 ? 0x8f1bbcdc : 0xca62c1d6
      const tmp = (rotl(a, 5) + f + e + k + w[t]) >>> 0
      e = d; d = c; c = rotl(bb, 30) >>> 0; bb = a; a = tmp
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + bb) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0
  }
  return [h0, h1, h2, h3, h4].map(x => x.toString(16).padStart(8, '0')).join('')
}

/** the text hash stored with alignments and word timings */
export const textHash = (s: string) => sha1(s).slice(0, 12)
