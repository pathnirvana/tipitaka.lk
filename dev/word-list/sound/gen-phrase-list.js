"use strict"

const fs = require('fs');
const path = require('path');
/**
 * 1) quote ending words must be sounded together with the base word
 * 2) try to find the longest and most occuring phrases
 * 
 */
const phraseSplitters = /[\.,\n]/g // comma, dot, new line

const allLines = []
function processEntry(e, eind, fileKey) {
    let text = e.text.replace(/[\*_~\$]|\{\d\}/g, '') // bold, underline, strike, footnote pointers
    text = text.replace(/\u200d/g, '') // for pali zwj too (ideally pali text should not contain zwj - but since we did this before, continue to do so)
    text = text.replace(/([\u0D80-\u0DFF]+)’([\u0D80-\u0DFF]+)/g, '$1$2') // join quote endings so they will not be separated in the next step
    text = text.replace(/[\:\[\]\(\)\{\}\-–;\d'"‘’“”\?\t\r…=]/g, ' ') // replace with spaces
    const lines = text.split(phraseSplitters).map(line => line.split(' ').filter(w => w.length)).filter(line => line.length)
    allLines.push(...lines)
}


const dataInputFolder = path.join(__dirname, '../../../public/static/text/')

// select only ap-dhs files
const inputFiles = fs.readdirSync(dataInputFolder).filter(name => /json$/.test(name)).filter(name => /^ap-dhs/.test(name))
let numEntries = 0, numFiles = 0
inputFiles.forEach(filename => {
    const fileKey = filename.split('.')[0]
    const obj = JSON.parse(fs.readFileSync(path.join(dataInputFolder, filename)))
    obj.pages.forEach((p, pi) => {
        p.pali.entries.forEach((e, ei) => processEntry(e, [pi, ei], fileKey))
        numEntries++
    })
    numFiles++
})

//allLines.forEach(line => line.forEach(word => addToList(wordList, word, 'count')))

function genPhrases(lines, numWords, freqCutoff) {
    const phrases = {}
    lines.forEach(words => {
        if (words.length < numWords) return // can not take a long phrase from a short line
        for (let i = numWords; i <= words.length; i++) {
            const phrase = words.slice(i - numWords, i).join(' ').trim()
            phrases[phrase] = phrases[phrase] ? phrases[phrase] + 1 : 1
        }
    })
    return Object.entries(phrases).filter(([phrase, freq]) => freq >= freqCutoff)
}

function writeWordList(list, filename) {
    list.sort((a, b) => a > b ? 1 : (a < b ? -1 : 0))
    fs.writeFileSync(path.join(__dirname, filename), list.map(ar => ar.join('\t')).join('\n'), 'utf-8')
}

const maxPhraseLength = 5, freqCutoff = 10, allPhrases = []
let singleWordList = []
for (let numWords = maxPhraseLength; numWords >= 1; numWords--) {
    const newPhrases = genPhrases(allLines, numWords, numWords == 1 ? 1 : freqCutoff)
    allPhrases.push(...newPhrases)
    if (numWords == 1) singleWordList = newPhrases
}

console.log(`processed ${numEntries} entries from ${numFiles} files`)

writeWordList(allPhrases, 'sound-phrases.txt')
writeWordList(singleWordList, 'sound-words.txt')
console.log(`wrote ${allPhrases.length} phrases and ${singleWordList.length} single words`)

