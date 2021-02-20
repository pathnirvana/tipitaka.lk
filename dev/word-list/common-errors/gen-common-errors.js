"use strict"

const fs = require('fs');
const path = require('path');
const { readWordList, writeHtml, getCstWordList } = require('../common-functions.js')
const cstWords = getCstWordList(), cst = (w) => cstWords[w] ? cstWords[w].freq : 0
//console.log(cstWords)

const propArAdd = (obj, prop, v) => {
    if (obj[prop]) obj[prop].push(v)
    else obj[prop] = [v]
}
const addPairs = (strV, list) => {
    strV.split(',').map(a => a.trim().split(':')).forEach(cpair => {
        propArAdd(list, cpair[0], cpair[1])
        propArAdd(list, cpair[1], cpair[0])
    })
}

function genPerms(word) {
    const matches = [...word.matchAll(variationsRegex)], perms = []
    matches.forEach(m => {
        variations[m[0]].forEach(v =>
            perms.push(word.substr(0, m.index) + v + word.substr(m.index + m[0].length)))
    })
    return perms
}

const linkSinh = (w, words) => `<a href="https://tipitaka.lk/fts/${w}/1-1-10">${w}</a>/${words[w] ? words[w].freq : 0}`
const linkPali = (w, words) => linkSinh(w, words) +`/${cst(w)}`
function potentialErrors(inputFilename, outFilename, ignoreWords = {}, getLink = linkPali) {
    const words = readWordList(inputFilename), errors = []; let permCount = 0
    
    Object.keys(words).filter(w => words[w].freq >= mainWordThres && words[w].length >= lengthThres) // && words[w].freq < 20
        .sort((a, b) => words[b].freq - words[a].freq)
        .forEach(w => {
            const perms = genPerms(w).filter(p => words[p] && !ignoreWords[p] 
                && words[p].freq <= words[w].freq/freqRatio && words[p].freq < errorWordThres //&& words[p].freq > words[w].freq/10
                && !p.endsWith('තී')) // not ends with thii - since normally those words are correct
            if (perms.length) {
                errors.push([w, perms])
                permCount += perms.length
            }
        })
    // fs.writeFileSync(path.join(__dirname, outFilename), 
    //     errors.map(([w, perms]) => `${w}/${words[w].freq}\t` + perms.map(p => `${p}/${words[p].freq}/${cst(w)}`).join('\t')).join('\n'),
    //     'utf-8')
    const tbody = errors.map(([w, perms], i) => `<td>${i}</td><td>` + [w, ...perms].map(w => getLink(w, words)).join('</td><td>') + '</td>').join('</tr><tr>')
    writeHtml(tbody, 'common-errors/' + outFilename)
    console.log(`potential visual errors: ${errors.length} main-words, ${permCount} error-words to ${outFilename}`)
}

let mainWordThres = 2, errorWordThres = 400, freqRatio = 2, lengthThres = 4 // for errors 
let variations = {}
;['\u0dca', '\u0dcf', '\u0dd0', '\u0dd1', '\u0dd2', '\u0dd3', '\u0dd4', '\u0dd6', '\u0dd9', '\u200d'].forEach(dv => variations[dv] = ['']) // delete dept vowel + zwj for sinh
const visualV = 'ජ:ඡ, ච:ව, න:ත, එ:ඵ, එ:ළු, ළු:ඵ, බ:ඛ, ධ:ඨ, ඨ:ඪ, ඊ:ර' // visually close pairs
const indeptVV = '\u0dd0:\u0dd1,\u0dd2:\u0dd3,\u0dd4:\u0dd6,\u0dd9:\u0dda,\u0ddc:\u0ddd'
const extraV =  'එ:ඒ,ඔ:ඕ,ක:ඛ,ග:ඝ,ච:ඡ,ජ:ඣ,ට:ඨ,ඩ:ඪ,ත:ථ,න:ණ,ද:ධ,ප:ඵ,බ:භ,ල:ළ,ශ:ෂ,ස:ඝ,හ:භ,ඤ:ඥ,ද:ඳ,ඩ:ඬ,ඞ:ඩ,ඞ:ඬ,ත:ට' // බ:ව removed
addPairs(visualV, variations)
addPairs(indeptVV, variations)
addPairs(extraV, variations)
let variationsRegex = new RegExp(Object.keys(variations).join('|'), 'g')
const ignoreWords = JSON.parse(fs.readFileSync(path.join(__dirname, 'pali-ignore.json'), 'utf-8'))
//potentialErrors('word-list-pali.txt', '1-common-errors-pali.txt') // dont run again since the list already modified 20, 40, 10, 4
//potentialErrors('word-list-pali.txt', '2-common-errors-pali-10-23.txt') // 20, 400, 2, 4
//potentialErrors('word-list-pali.txt', '3-common-errors-11-04.txt', ignoreWords) // 20, 400, 2, 4
//potentialErrors('word-list-pali.txt', '4-common-errors-11-12.txt', ignoreWords) // 20, 400, 2, 4 - only contained the missing hal from 3
//potentialErrors('word-list-pali.txt', '6-common-errors-11-27.txt', ignoreWords) // 19-2, 400, 2, 4 - 
//potentialErrors('word-list-pali.txt', '7-common-errors-01-04.txt', ignoreWords) // 2, 400, 2, 4 - 

//potentialErrors('word-list-sinh.txt', '5-common-errors-sinh.txt', {}, linkSinh) // 5, 400, 5, 4


mainWordThres = 1, errorWordThres = 40, freqRatio = 1, lengthThres = 4 // for inconsistencies 
const niggahithaV = 'ඞ්:ං, ඤ්:ං, ම්:ං, න්:ං, ඞ්:ඤ්, ඤ්:ම්, ඞ්:ම්, ව්:බ්'
variations = {}; addPairs(niggahithaV, variations) // for inconsistencies
variationsRegex = new RegExp(Object.keys(variations).join('|'), 'g')
//potentialErrors('word-list-pali.txt', 'niggahitha-inconsistencies-pali.txt')


function getSinhOEInconsistencies() {
    const words = readWordList('word-list-sinh.txt'), outFilename = 'sinh-inconsistencies-ooee.txt', errors = []
    Object.keys(words).filter(w => /[ඔඑ\u0dd9\u0ddc]/.test(w)).forEach(w => {
        w.replace(/[ඔඑ\u0dd9\u0ddc]/g, (m, i) => {
            const p = w.substr(0, i) + String.fromCharCode(m.charCodeAt(0) + 1) + w.substr(i + 1)
            if (words[p]) errors.push([w, p])
        })
    })
    const tbody = errors.map((pair, i) => `<td>${i}</td><td>` + pair.map(w => linkSinh(w, words)).join('</td><td>') + '</td>').join('</tr><tr>')
    writeHtml(tbody, 'common-errors/' + outFilename)
    console.log(`potential oe inconsistencies: ${errors.length} to ${outFilename}`)
}
//getSinhOEInconsistencies()


// function getRephInconsistencies() {
//     const lowerMap = { '\u0dda': '\u0dd9', '\u0ddd': '\u0ddc' }
//     const words = readWordList('word-list-sinh.txt'), outFilename = 'sinh-inconsistencies-reph.txt', errors = []
//     Object.keys(words).filter(w => /ර\u0dca[ක-ෆ]/.test(w)).forEach(w => {
//         const withReph = w.replace(/ර\u0dca([ක-ෆ])(.?)/g, (m, p1, p2) => 'ර\u0dca\u200d' + p1 + (lowerMap[p2] || p2))
//         errors.push([withReph, w])
//     })
//     const tbody = errors.sort((a, b) => a[1] > b[1] ? 1 : -1) // alphabetic order
//         .map((pair, i) => `<td>${i}</td><td>` + pair.map(w => linkSinh(w, words)).join('</td><td>') + '</td>').join('</tr><tr>')
//     writeHtml(tbody, 'common-errors/' + outFilename)
//     console.log(`potential reph inconsistencies: ${errors.length} to ${outFilename}`)
// }
//getRephInconsistencies()

// function getRephYansaInconsistencies() {
//     const words = readWordList('word-list-sinh.txt'), outFilename = 'sinh-inconsistencies-reph-yansa.txt', errors = []
//     Object.keys(words).filter(w => /ර\u0dcaය([^\u0dca])/.test(w)).forEach(w => {
//         const withReph = w.replace(/ර\u0dcaය([^\u0dca])/g, (m, p1) => 'ර\u0dca\u200dය\u0dca\u200dය' + (lowerMap[p1] || p1))
//         errors.push([withReph, w])
//     })
//     const tbody = errors.sort((a, b) => a[1] > b[1] ? 1 : -1) // alphabetic order
//         .map((pair, i) => `<td>${i}</td><td>` + pair.map(w => linkSinh(w, words)).join('</td><td>') + '</td>').join('</tr><tr>')
//     writeHtml(tbody, 'common-errors/' + outFilename)
//     console.log(`potential reph-yansa inconsistencies: ${errors.length} to ${outFilename}`)
// }
//getRephYansaInconsistencies()

function getSinhInconsistencies(name, pattern, replaceFunc) {
    const words = readWordList('word-list-sinh.txt'), outFilename = `sinh-inconsistencies-${name}.txt`,
        gPattern = new RegExp(pattern.source, 'g'), errors = []  // replace needs a global pattern while test needs a non-global one
    Object.keys(words).filter(w => pattern.test(w)).forEach(w => {
        const fixed = w.replace(gPattern, replaceFunc)
        if (fixed && fixed != w) errors.push([fixed, w])
    })
    const tbody = errors.sort((a, b) => a[1] > b[1] ? 1 : -1) // alphabetic order
        .map((pair, i) => `<td>${i}</td><td>` + pair.map(w => linkSinh(w, words)).join('</td><td>') + '</td>').join('</tr><tr>')
    writeHtml(tbody, 'common-errors/' + outFilename)
    console.log(`potential ${name} inconsistencies: ${errors.length} to ${outFilename}`)
}

const lowerMap = { '\u0dda': '\u0dd9', '\u0ddd': '\u0ddc' }
//getSinhInconsistencies('reph-yansa', /ර\u0dcaය([^\u0dca])/, (m, p1) => 'ර\u0dca\u200dය\u0dca\u200dය' + (lowerMap[p1] || p1)) // done
getSinhInconsistencies('reph-ththa', /ර\u0dca\u200d?(ත?\u0dca?\u200d?ථ)$/, (m, p1) => 'ර\u0dca\u200dත\u0dca\u200dථ') // |ත\u0dca?\u200d?ථ? // done
getSinhInconsistencies('joined', /([නතක])\u0dca([දධවථෂ])/, (m, p1, p2) => p1 + '\u0dca\u200d' + p2)
getSinhInconsistencies('reph-vowels', /ර\u0dca\u200d?([ක-ෆ])([\u0dd0-\u0df3])/, (m, p1, p2) => 'ර\u0dca' + p1 + p2)
//getSinhInconsistencies('reph', /ර\u0dca([ක-ෆ])([^\u0dd0-\u0df3])/, (m, p1, p2) => 'ර\u0dca\u200d' + p1 + p2) //(?:\u0dca\u200d?[ක-ෆ])?
getSinhInconsistencies('reph', /ර\u0dca([ක-ෆ])$/, (m, p1, p2) => 'ර\u0dca\u200d' + p1)
//getSinhInconsistencies('ooee', /[ඕඒ\u0dda\u0ddd]/, (m) => String.fromCharCode(m.charCodeAt(0) - 1))

function countJoinedLetters() {
    const words = readWordList('word-list-sinh.txt'), counts = {}, freqSum = {}
    Object.keys(words).forEach(w => {
        [...w.matchAll(/([නතක])\u0dca\u200d?([දධවථෂ])/g)].forEach(m => {
            if (counts[m[0]]) {
                counts[m[0]]++
                freqSum[m[0]] += Number(words[w].freq)
            } else {
                counts[m[0]] = 1
                freqSum[m[0]] = Number(words[w].freq)
            }
        })
    })
    console.log(Object.keys(counts).map(k => [k, counts[k], freqSum[k]].join('\t')).join('\n'))
}
countJoinedLetters()