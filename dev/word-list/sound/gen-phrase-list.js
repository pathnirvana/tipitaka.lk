"use strict"

const fs = require('fs');
const path = require('path');
//const { writeHtml } = require('../common-functions.js')
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


process.exit(0)








/** check for spacing inconsistencies */
function inconsistentSpacing(wordList, lang, filePath) {
    const wList = {}, errors = {}
    Object.keys(wordList).forEach(w => wList[w] = sumValues(wordList[w]))
    splitWordsCorpus[lang].forEach(words => {
        for (let i = 1; i < words.length; i++) {
            if (lang == 'pali' && ['පි', 'න', 'නො', 'ති', 'න්ති'].indexOf(words[i]) >= 0) continue
            const comb2 = words[i-1] + words[i], comb3 = i > 1 ? words[i-2] + comb2 : ''
            if (wList[comb2]) addToList(errors, comb2, words[i-1] + ' ' + words[i])
            if (wList[comb3]) addToList(errors, comb3, words[i-2] + ' ' + words[i-1] + ' ' + words[i])
        } 
    })
    
    const errorAr = Object.keys(errors).map(comb => // 3-d array
        [[comb, wList[comb]], ...Object.keys(errors[comb]).map(pair => [pair, errors[comb][pair]])]
            .sort((a, b) => b[1] - a[1])
    ).sort((a, b) => b[0][1] - a[0][1]) // sort by 2 dimentions

    // fs.writeFileSync(path.join(__dirname, filePath), errorAr.map(ar => ar.map(wf => wf.join(':')).join('\t')).join('\n'), 'utf-8')
    const tbody = errorAr.map(ar => '<td>' + ar.map(([w, f]) => `<a href="https://tipitaka.lk/fts/${w.replace(/ /g, '%20')}/1-1-10">${w}</a>/${f}`).join('</td><td>') + '</td>').join('</tr><tr>')
    writeHtml(tbody, filePath)
    console.log(`wrote ${errorAr.length} lines ${errorAr.reduce((a, v) => a + v.length, 0)} words to ${filePath}`)
}
inconsistentSpacing(wordListPali, 'pali', 'spacing-inconsistencies-pali.txt')
inconsistentSpacing(wordListSinh, 'sinh', 'spacing-inconsistencies-sinh.txt')


/** count the endings with quotes */ 
function wordsEnding(words, lang, ending) { // add to lists only if a quoteWord
    if (lang != 'pali') return
    const list = wordListEnding[ending], qList = quoteWords[ending]
    words.forEach((w, i) => {
        if (w.endsWith(ending) && w.length > 2 && qList[w]) addToList(list, w, 'no-s') // no space/ one word
        if (w == ending && i > 0) {
            const word = words[i-1] + ending
            if (qList[word]) addToList(list, word, 'q-or-s') // quote or space
        }
    })
}

const quoteCounts = Object.entries(quoteWords).map(([e, words]) => [e, sumValues(words), Object.keys(words).length]).sort((a, b) => b[1] - a[1])
const endings = quoteCounts.map(wfc => wfc[0]), wordListEnding = {}, topEndings = endings.slice(0, 10), smallTables = []
endings.forEach(ending => wordListEnding[ending] = {})
splitWordsCorpus['pali'].forEach(words => {
    endings.forEach(ending => wordsEnding(words, 'pali', ending))
})

endings.forEach(ending => {
    const list = wordListEnding[ending], linkWGen = w => w.replace(new RegExp(ending + '$'), '%20' + ending)
    Object.keys(list).forEach(w => {
        list[w].q = quoteWords[ending][w]
        list[w].s = list[w]['q-or-s'] - list[w].q
        delete list[w]['q-or-s']
    })
    if (topEndings.indexOf(ending) >= 0)
        writePhrases(list, `endings/word-list-${ending}.txt`, linkWGen)
    else 
        smallTables.push(`<td colspan="3">Ending: ${ending}</td></tr><tr>` + writePhrases(list, '', linkWGen))
})
writeHtml(smallTables.join('</tr></table><br><table><tr>'), 'endings/word-list-other-endings.txt')
fs.writeFileSync(path.join(__dirname, 'endings/quote-endings.txt'), quoteCounts.map(wfc => wfc.join('\t')).join('\n'), 'utf-8')



