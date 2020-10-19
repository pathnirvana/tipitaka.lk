"use strict"

const fs = require('fs');
const path = require('path');
const { writeHtml } = require('./common-functions.js')

const readWordList = (filename) => { // read output from gen-word-list script
    const words = {}
    fs.readFileSync(path.join(__dirname, filename), 'utf-8').split('\n').forEach(l => {
        const entries = l.split('\t'), w = entries[0]
        words[w] = { word: w, freq: entries[1], length: w.length }
    })
    return words
}

const visualV = 'ජ:ඡ, ච:ව, න:ත' // visually close pairs
const indeptVV = '\u0dd0:\u0dd1,\u0dd2:\u0dd3,\u0dd4:\u0dd6,\u0dd9:\u0dda,\u0ddc:\u0ddd'
const extraV = 'එ:ඒ,ඔ:ඕ,ක:ඛ,ග:ඝ,ච:ඡ,ජ:ඣ,ට:ඨ,ඩ:ඪ,ත:ථ,න:ණ,ද:ධ,ප:ඵ,බ:භ,ල:ළ,ශ:ෂ,ස:ඝ,හ:භ,ඤ:ඥ,ද:ඳ,ඩ:ඬ,ඞ:ඩ,ඞ:ඬ,බ:ව'
const niggahithaV = 'ඞ්:ං, ඤ්:ං, ම්:ං, න්:ං, ඞ්:ඤ්, ඤ්:ම්, ඞ්:ම්, ව්:බ්' //  no effect
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

const mainWordThres = 20, errorWordThres = 40, freqRatio = 10, lengthThres = 4 // for errors
const variations = { '\u0DCA': [''], }
addPairs(visualV, variations)
addPairs(indeptVV, variations)
addPairs(extraV, variations)

// const mainWordThres = 1, errorWordThres = 40, freqRatio = 1, lengthThres = 4 // for inconsistencies 
// const variations = {}; addPairs(niggahithaV, variations) // for inconsistencies
//console.log(variations)

const variationsRegex = new RegExp(Object.keys(variations).join('|'), 'g')
function genPerms(word) {
    const matches = [...word.matchAll(variationsRegex)], perms = []
    matches.forEach(m => {
        variations[m[0]].forEach(v =>
            perms.push(word.substr(0, m.index) + v + word.substr(m.index + m[0].length)))
    })
    return perms
}
const link = (w, words) => `<a href="https://tipitaka.lk/fts/${w}/1-1-10">${w}</a>/${words[w].freq}`
function potentialErrors(inputFilename, outFilename) {
    const words = readWordList(inputFilename), errors = []; let permCount = 0
    
    Object.keys(words).filter(w => words[w].freq >= mainWordThres && words[w].length >= lengthThres)
        .sort((a, b) => words[b].freq - words[a].freq)
        .forEach(w => {
            const perms = genPerms(w).filter(p => words[p] 
                && words[p].freq <= words[w].freq/freqRatio && words[p].freq < errorWordThres
                && !p.endsWith('තී')) // not ends with thii - since normally those words are correct
            if (perms.length) {
                errors.push([w, perms])
                permCount += perms.length
            }
        })
    fs.writeFileSync(path.join(__dirname, outFilename), 
        errors.map(([w, perms]) => `${w}/${words[w].freq}\t` + perms.map(p => `${p}/${words[p].freq}`).join('\t')).join('\n'),
        'utf-8')
    const tbody = errors.map(([w, perms], i) => `<td>${i}</td><td>` + [w, ...perms].map(w => link(w, words)).join('</td><td>') + '</td>').join('</tr><tr>')
    writeHtml(tbody, outFilename)
    console.log(`potential visual errors: ${errors.length} words, ${permCount} error-words to ${outFilename}`)
}

//console.log(genPerms('අබ්යාකත'))
potentialErrors('word-list-pali.txt', 'visual-extra-errors-pali.txt')
potentialErrors('word-list-sinh.txt', 'visual-extra-errors-sinh.txt')
//potentialErrors('word-list-pali.txt', 'niggahitha-inconsistencies-pali.txt')