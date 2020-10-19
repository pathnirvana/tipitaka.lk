"use strict"

const fs = require('fs');
const path = require('path');
const { writeHtml } = require('./common-functions.js')

function addToList(list, word, category) {
    if (list[word]) {
        if (list[word][category]) list[word][category]++
        else list[word][category] = 1
    } else {
        list[word] = { [category]: 1 }
    }
}

function processEntry(e, eind, lang, fileKey) {
    let text = e.text.replace(/\*|_|~|\$|\{\d\}|\u200d/g, '') // zwj and footnote pointers
    const wordList = (lang == 'pali') ? wordListPali : wordListSinh
    text = text.replace(/[\.\:\[\]\(\)\{\}\-–,;\d'"‘’“”\?\n\t\r]/g, ' ') // replace with spaces
    const words = text.split(' ').filter(w => w.length)
    splitWordsCorpus[lang].push(words) // used for inconsistentSpacing
    words.forEach(word => addToList(wordList, word, 'count'))
    wordsEndingInPI(words, lang)
    numEntries++
}

function wordsEndingInPI(words, lang) {
    if (lang != 'pali') return
    const list = wordListPI
    words.forEach((w, i) => {
        if (w.endsWith('පි') && w.length > 2) addToList(list, w, 'no-s') // no space/ one word
        if (w == 'පි' && i > 0) addToList(list, words[i-1] + 'පි', 'q-or-s') // quote or space
    })
}
function inconsistentSpacing(wordList, lang, filePath) {
    const wList = {}, errors = {}
    Object.keys(wordList).forEach(w => wList[w] = sumValues(wordList[w]))
    splitWordsCorpus[lang].forEach(words => {
        for (let i = 1; i < words.length; i++) {
            if (['පි', 'න', 'නො', 'ති', 'න්ති'].indexOf(words[i]) >= 0) continue
            const comb2 = words[i-1] + words[i], comb3 = i > 1 ? words[i-2] + comb2 : ''
            if (wList[comb2]) addToList(errors, comb2, words[i-1] + ' ' + words[i])
            if (wList[comb3]) addToList(errors, comb3, words[i-2] + ' ' + words[i-1] + ' ' + words[i])
        } 
    })
    
    const errorAr = Object.keys(errors).map(comb => // 3-d array
        [[comb, wList[comb]], ...Object.keys(errors[comb]).map(pair => [pair, errors[comb][pair]])]
            .sort((a, b) => b[1] - a[1])
    ).sort((a, b) => b[0][1] - a[0][1]) // sort by 2 dimentions

    fs.writeFileSync(path.join(__dirname, filePath),
        errorAr.map(ar => ar.map(wf => wf.join(':')).join('\t')).join('\n'), 'utf-8')
    const tbody = errorAr.map(ar => ar.map(([w, f]) => `<a href="https://tipitaka.lk/fts/${w.replace(/ /g, '%20')}/1-1-10">${w}</a>:${f}`).join('\t\t')).join('</td></tr><tr><td>')
    writeHtml(`<td>${tbody}</td>`, filePath)
    console.log(`wrote ${errorAr.length} lines ${errorAr.reduce((a, v) => a + v.length, 0)} words to ${filePath}`)
}

function writeWordList(list, filePath, linkWGen = w => w) {
    const listAr = Object.keys(list).map(w => [w, sumValues(list[w]), JSON.stringify(list[w])]).sort((a, b) => b[1] - a[1])
    fs.writeFileSync(path.join(__dirname, filePath), listAr.map(ar => ar.join('\t')).join('\n'), 'utf-8')
    
    const tbody = listAr.map(([w, sum, str]) => `<td><a href="https://tipitaka.lk/fts/${linkWGen(w)}/1-1-10">${w}</a></td><td>${sum}</td><td>${str}</td>`).join('</tr><tr>')
    writeHtml(tbody, filePath)
    
    console.log(`wrote ${Object.keys(list).length} words to ${filePath}`)
}

const wordListPali = {}, wordListSinh = {}, wordListPI = {}, splitWordsCorpus = { pali: [], sinh: [] }
const sumValues = obj => Object.values(obj).reduce((a, v) => a + v)
const dataInputFolder = path.join(__dirname, '../../public/static/text/')

// select only mula files
const inputFiles = fs.readdirSync(dataInputFolder).filter(name => /json$/.test(name)).filter(name => !/^atta/.test(name))
let numEntries = 0, numFiles = 0
inputFiles.forEach(filename => {
    const fileKey = filename.split('.')[0]
    const obj = JSON.parse(fs.readFileSync(path.join(dataInputFolder, filename)))
    obj.pages.forEach((p, pi) => {
        p.pali.entries.forEach((e, ei) => processEntry(e, [pi, ei], 'pali', fileKey))
        p.sinh.entries.forEach((e, ei) => processEntry(e, [pi, ei], 'sinh', fileKey))
    })
    numFiles++
})
console.log(`processed ${numEntries} entries from ${numFiles} files`)

writeWordList(wordListPali, 'word-list-pali.txt')
writeWordList(wordListSinh, 'word-list-sinh.txt')
Object.keys(wordListPI).forEach(w => wordListPI[w]['q-or-s'] || delete wordListPI[w])
writeWordList(wordListPI, 'word-list-pi-q-or-s.txt', w => w.replace(/පි$/, '%20පි'))
//Object.keys(wordListPI).forEach(w => !wordListPI[w]['q-or-s'] || delete wordListPI[w])
//writeWordList(wordListPI, 'word-list-pi-no-s.txt')
inconsistentSpacing(wordListPali, 'pali', 'spacing-inconsistencies-pali.txt')
