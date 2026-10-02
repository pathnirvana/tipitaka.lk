/**
 * Code for convering to bandi akuru and processing footnotes
 * Modified from the text-convert in the proofreading app
 */
"use strict"

const commonConjuncts = [ // used in sinhala too - more common
    ['ක', 'ව'],
    ['ත', 'ථ'],
    ['ත', 'ව'],
    ['න', 'ථ'],
    ['න', 'ද'],
    ['න', 'ධ'],
]
const paliConjuncts = [ // pali conjuncts with special ligratures
    ['ඤ', 'ච'],
    ['ඤ', 'ජ'],
    ['ඤ', 'ඡ'],
    ['ට', 'ඨ'],
    ['ණ', 'ඩ'],
    ['ද', 'ධ'],
    ['ද', 'ව']
]

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
function addBandiLetters(text) {
    text = text.replace(/\u200C/g, ''); // remove 200c char that appears in tipitaka.org text
    text = text.replace(/([ක-ෆ])\u0DCA([ක-ෆ])/g, '$1\u200D\u0DCA$2'); // adding a zwj between consos
    text = text.replace(/([ක-ෆ])\u0DCA([ක-ෆ])/g, '$1\u200D\u0DCA$2'); // do twice to handle consecutive hal ගන්ත්වා

    // remove hal
    text = text.replace(/\u0DDA/g, "\u0DD9"); //ee => e
    text = text.replace(/\u0DDD/g, "\u0DDC"); //oo => o

    return text;
}

function addCommonConjuncts(text) {
    // special conjunct cases
    commonConjuncts.forEach(pair => {
        const re = new RegExp(pair[0] + "\u0DCA" + pair[1], "g") // TODO precompute these
        text = text.replace(re, pair[0] + "\u0DCA\u200D" + pair[1]);
    })
    return text
}

function addPaliConjuncts(text) {
    paliConjuncts.forEach(pair => {
        const re = new RegExp(pair[0] + "\u0DCA" + pair[1], "g") // TODO precompute these
        text = text.replace(re, pair[0] + "\u0DCA\u200D" + pair[1]);
    })
    return text
}

function addRakarYansa(text) {
     // adding the rakar & yansa
    // change joiners before U+0DBA Yayanna and U+0DBB Rayanna to Virama + ZWJ
    return text.replace(/\u0DCA([\u0DBA\u0DBB])/g, '\u0DCA\u200D$1');
}

// add rakar and common conjuncts
export function beautifyText(text, lang, {bandiLetters, specialLetters}) {
    if (lang == 'sinh') return text // issue pointed out by Vincent - උස්යහනින්/අඳුන්දිවිසමින්
    text = addRakarYansa(text)    
    text = addCommonConjuncts(text)
    if (lang == 'pali') {
        if (specialLetters) text = addPaliConjuncts(text)
        if (bandiLetters) text = addBandiLetters(text)
    }
    return text
}

export function beautifyFTSText(text, lang, options) {
    if (lang != 'sinh') return beautifyText(text, lang, options)
    return addRakarYansa(text) // even though උස්යහනින් is still a problem this is needed as fts lacks 200d
}