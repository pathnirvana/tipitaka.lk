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

const linkSinh = (w, words) => `<a href="https://tipitaka.lk/fts/${w}/1-1-10">${w}</a>/${words[w].freq}`
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
potentialErrors('word-list-pali.txt', '7-common-errors-01-04.txt', ignoreWords) // 2, 400, 2, 4 - 

//potentialErrors('word-list-sinh.txt', '5-common-errors-sinh.txt', {}, linkSinh) // 5, 400, 5, 4


mainWordThres = 1, errorWordThres = 40, freqRatio = 1, lengthThres = 4 // for inconsistencies 
const niggahithaV = 'ඞ්:ං, ඤ්:ං, ම්:ං, න්:ං, ඞ්:ඤ්, ඤ්:ම්, ඞ්:ම්, ව්:බ්'
variations = {}; addPairs(niggahithaV, variations) // for inconsistencies
variationsRegex = new RegExp(Object.keys(variations).join('|'), 'g')
//potentialErrors('word-list-pali.txt', 'niggahitha-inconsistencies-pali.txt')