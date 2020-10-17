"use strict"

const fs = require('fs');
const path = require('path');

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
    text = text.replace(/[\.\:\[\]\(\)\{\}\-–,\d'"‘’“”\?\n\t\r]/g, ' ') // replace with spaces
    const words = text.split(' ').filter(w => w.length)
    words.forEach(word => addToList(wordList, word, 'count'))
    customWordLists(words, lang)
    numEntries++
}

function customWordLists(words, lang) {
    if (lang != 'pali') return
    const list = wordListCustom
    words.forEach((w, i) => {
        if (w.endsWith('පි') && w.length > 2) addToList(list, w, 'no-s') // no space/ one word
        if (w == 'පි' && i > 0) addToList(list, words[i-1] + 'පි', 'q-or-s') // quote or space
    })
}

function writeWordList(list, filePath) {
    fs.writeFileSync(path.join(__dirname, filePath), 
        Object.keys(list).map(w => [w, sumValues(list[w]), JSON.stringify(list[w])])
            .sort((a, b) => b[1] - a[1]).map(ar => ar.join('\t')).join('\n'), 
        'utf-8')
}

function potentialErrors(inputList, filename) {
    const words = {}, errors = []
    Object.keys(inputList).forEach(w => words[w] = {freq: sumValues(inputList[w]), length: w.length})
    Object.keys(words).filter(w => words[w].freq >= 20 && words[w].length > 3)
        .sort((a, b) => words[b].freq - words[a].freq)
        .forEach(w => {
            const perms = genPerms(w).filter(p => words[p] && words[p].freq <= Math.round(words[w].freq/20))
            if (perms.length) {
                errors.push(`${w}:${words[w].freq}\t` + perms.map(p => `${p}:${words[p].freq}`).join('\t'))
            }
        })
    fs.writeFileSync(path.join(__dirname, filename), errors.join('\n'), 'utf-8')
    console.log(`wrote ${errors.length} potential error words to ${filename}`)
}

const variations = { // visually close pairs
    'ජ': 'ඡ',
    'ඡ': 'ජ',
    'ච': 'ව',
    'ව': 'ච',
    'න': 'ත',
    'ත': 'න',
    'ි': 'ී',
    'ී': 'ි',
    'ු': 'ූ',
    'ූ': 'ු',
    '\u0DCA': '',
}
const variationsRegex = new RegExp(Object.keys(variations).join('|'), 'g')
function genPerms(word) {
    const matches = [...word.matchAll(variationsRegex)], perms = []
    matches.forEach(m => {
        perms.push(word.substr(0, m.index) + variations[m[0]] + word.substring(m.index + 1))
        // const perm = word.slice() // make a copy
        // perm.splice(m.index, 1, variations[m[0]])
        // perms.push(perm)
    })
    return perms
    // word.replace(/\uDCA0/g, (m, offset) => {
    //     perms.push()
    // })
}

const wordListPali = [], wordListSinh = [], wordListCustom = []
const sumValues = obj => Object.values(obj).reduce((a, b) => a + b)
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

writeWordList(wordListPali, 'word-list-pali.csv')
writeWordList(wordListSinh, 'word-list-sinh.csv')
//Object.keys(wordListCustom).forEach(w => wordListCustom[w]['q-or-s'] || delete wordListCustom[w])
//writeWordList(wordListCustom, 'word-list-custom2.csv')
console.log(`wrote ${numEntries} entries from ${numFiles} to word list`)
potentialErrors(wordListPali, 'word-list-errors-pali.csv')