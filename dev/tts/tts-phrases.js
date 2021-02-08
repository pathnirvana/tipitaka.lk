"use strict"

const fs = require('fs');
const path = require('path');
//const { writeHtml } = require('./common-functions.js')
const vkb = require('vkbeautify')
const _ = require('lodash');


function addToList(list, level, word) {
    if (list[level]) {
        if (list[level][word]) list[level][word]++
        else list[level][word] = 1
    } else {
        list[level] = { [word]: 1 }
    }
}


function extractText(text, lang) {
    text = text.replace(/[\*_~\$\r\u200c]|\{\S{1,2}\}/g, '') // bold, underline, strike, footnote pointers
    if (lang == 'pali') text = text.replace(/\u200d/g, '') // for pali zwj too (ideally pali text should not contain zwj - but since we did this before, continue to do so)
    text = text.replace(/[\-\:!]/g, ',') // dash and colon by comma - short space
    text = text.replace(/[;\n]/g, '.') // semicolon and newline by dot - long space

    if (lang == 'pali') {
        // following two lines joins the words separated by quotes 
        text = text.replace(/([\u0D80-\u0DFF]+)’([\u0D80-\u0DFF]+)/g, '') // remove quotes in the middle of the text
        text = text.replace(quoteRegex, '$1$2') // remove space infront of identified quote endings - joining the words
    }
    
    text = text.replace(/[^ ,\.\?\u0D80-\u0DFF\u200d]/g, ' ') // replace with spaces. [?,.] should be retained for now 
    text = text.replace(/\s*([,\.\?])/g, '$1 ').replace(/\s+/g, ' ').trim(); // remove extra spaces
    if (/[^ ,\.\?\u0D80-\u0DFF\u200d]/.test(text)) console.error(`unwanted char found in ${text}`)
    return text
}

function extractPhrases(text, level) {
    const words = text.split(' ')
    _.range(words.length).forEach(i => {
        if (i + level + 1 > words.length) return
        const phraseWords = words.slice(i, i + level + 1), phrase = phraseWords.join(' ')
        // all words should be > cutoff freq for this phrase to be included
        // but some phrases < cutoff freq will still be included - just a crude filter reduce the # of phrases for next step
        if (level > 0 && !phraseWords.every(w => phraseList[0][w] >= levelCutoff)) return 

        if (/[,\.\?]/.test(phrase.slice(0, -1))) return // special char in the middle of phrase
        addToList(phraseList, level, phrase.replace(/[\.,]/g, '')) // remove ,. too since these are no longer needed
    })
}

// function writeWordList(list, filePath, linkWGen = w => w) {
//     const listAr = Object.keys(list).map(w => [w, sumValues(list[w]), JSON.stringify(list[w])]).sort((a, b) => b[1] - a[1])
//     const tbody = listAr.map(([w, sum, str]) => `<td><a href="https://tipitaka.lk/fts/${linkWGen(w)}/1-1-10">${w}</a></td><td>${sum}</td><td>${str}</td>`).join('</tr><tr>')
//     if (filePath.length) {
//         fs.writeFileSync(path.join(__dirname, filePath), listAr.map(ar => ar.join('\t')).join('\n'), 'utf-8')
//         writeHtml(tbody, filePath)
//         console.log(`wrote ${Object.keys(list).length} words to ${filePath}`)
//     }
//     return tbody
// }



const phraseList = [], levelCutoff = 100, textEntries = []
const sumValues = obj => Object.values(obj).reduce((a, v) => a + v, 0)

const qouteEndings = fs.readFileSync(path.join(__dirname, '../word-list/endings/quote-endings.txt'), 'utf-8').split('\n').map(l => l.split('\t'))
    .filter(([end, freq, n]) => freq > 1).map(ar => ar[0])
qouteEndings.push(...['ති', 'න්ති', 'තිස්ස', 'තිපි', 'මීති']) // these were excluded from the above file
const quoteRegex = new RegExp(` (${qouteEndings.join('|')})([ ,\.\?])`, 'g')
console.log(`read ${qouteEndings.length} quote endings to be joined`)


// select only mula files
const dataInputFolder = path.join(__dirname, '../../public/static/text/'), lang = 'sinh'
const inputFiles = fs.readdirSync(dataInputFolder).filter(name => /json$/.test(name)).filter(name => !/^atta/.test(name))
let numEntries = 0, numFiles = 0
inputFiles.forEach(filename => {
    //const fileKey = filename.split('.')[0]
    const obj = JSON.parse(fs.readFileSync(path.join(dataInputFolder, filename)))
    obj.pages.forEach((p, pi) => {
        p[lang].entries.forEach((e, ei) => textEntries.push(extractText(e.text, lang)))
        numEntries += p[lang].entries.length
    })
    numFiles++
})
console.log(`processed ${numEntries} entries from ${numFiles} files`)



function processLevel(level) {
    textEntries.forEach(text => extractPhrases(text, level))
    if (level > 0) Object.entries(phraseList[level]).filter(([p, f]) => f < levelCutoff).forEach(([w, f]) => delete phraseList[level][w])
    const finalPhrases = Object.keys(phraseList[level]).length
    console.log(`level ${level}, ${finalPhrases} phrases`)
}

function removeDuplicates() { // remove phares that already occurr in a higher level
    const dedupPhrases = []
    _.range(2, numLevels).forEach(level => dedupPhrases.push(...Object.keys(phraseList[level])))
    _.range(1, numLevels).forEach(level => {
        Object.entries(phraseList[level]).forEach(([p, f]) => {
            if (dedupPhrases.some(plong => plong.includes(p) && plong != p)) delete phraseList[level][p]
        })
        console.log(`level ${level}, removed duplicates - ${Object.keys(phraseList[level]).length} phrases left`)
    })
    // _.range(numLevels).reverse().slice(0, -1).forEach(level => { // only for level > 0
    //     Object.entries(phraseList[level]).forEach(([phrase, f]) => {
    //         const words = phrase.split(' ');
    //         [words.slice(0, -1), words.slice(1)].forEach(sp => delete phraseList[level - 1][sp.join(' ')])
    //     })
    //     console.log(`level ${level-1}, removed duplicates - final ${Object.keys(phraseList[level-1]).length} phrases left`)
    // })
}

const numLevels = 2
_.range(numLevels).forEach(level => processLevel(level))
removeDuplicates()

fs.writeFileSync(path.join(__dirname, `phrases-${lang}.json`), vkb.json(JSON.stringify(phraseList)), 'utf-8')


// sentences are more easier to speak and record - try to extract some interesting sentences that are not too long or short also has common long words 
const wordCounts = phraseList[0], ttsSentences = {}, selectedWCounts = {}
const cleanNonSinh = s => s.replace(/[^\u0d82-\u0ddf\u0df2 ]/g, '') // anything non sinhala or space removed
cleanNonSinh(fs.readFileSync('E:/tts_datasets/sinhala/new-dataset/prompts.txt', 'utf-8').replace(/[\s\u00a0\d\n]+/g, ' ')).split(' ')
    .forEach(w => selectedWCounts[w] = (selectedWCounts[w] || 0) + 1)
console.log(`selected words count ${Object.keys(selectedWCounts).length}`)
const logCount = (w) => Math.max(Math.ceil(Math.log10(wordCounts[w])), 1)

_.shuffle(textEntries).forEach(text => text.split(/[\?\.]/)
    .map(s => s.trim())
    .filter(s => s.length >= 40 && s.length <= 200) // sentence length filter
    .forEach(s => {
        const sWords = cleanNonSinh(s).split(' ').filter(w => w.length > 2)
        // at least 1/4 of the words greater than freq 20 and selected less than 3 (used log) times
        if (sWords.filter(w => wordCounts[w] >= 5 && selectedWCounts[w] < logCount(w)).length < sWords.length / 2.5) return
        // lot of words already selected many times - prefer shorter sentences
        if (sWords.filter(w => selectedWCounts[w] > logCount(w)).length >= sWords.length / 2) return 
        //if (sWords.indexOf('ස්කන්ධසඞ්ඛ්‍යාවෙන්') >= 0) console.log(sWords)
        if (sWords.some(w => wordCounts[w] <= 2)) return // at least one word with small occurance - could be a typo
        if (sWords.filter(w => wordCounts[w] == 1).length) console.log(sWords)
        if (!ttsSentences[s]) {
            ttsSentences[s] = 1
            sWords.forEach(w => selectedWCounts[w] = (selectedWCounts[w] || 0) + 1)
        }
        //ttsSentences[s] = (ttsSentences[s] || 0) + 1
    }))
const sortedSentences = Object.entries(ttsSentences)
    //.filter(p => p[1] > 3 || p[0].endsWith('ද'))
    .map(([s, f]) => s) // + '.\t' + f)
    .sort((sa, sb) => sa > sb ? 1 : -1)

fs.writeFileSync(path.join(__dirname, `sentences-${lang}.tsv`), sortedSentences.join('\n'), 'utf-8')
console.log(`wrote ${sortedSentences.length} sentences to sentences-${lang}.json`)


process.exit(0)












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
        writeWordList(list, `endings/word-list-${ending}.txt`, linkWGen)
    else 
        smallTables.push(`<td colspan="3">Ending: ${ending}</td></tr><tr>` + writeWordList(list, '', linkWGen))
})
writeHtml(smallTables.join('</tr></table><br><table><tr>'), 'endings/word-list-other-endings.txt')
fs.writeFileSync(path.join(__dirname, 'endings/quote-endings.txt'), quoteCounts.map(wfc => wfc.join('\t')).join('\n'), 'utf-8')


/** check for spacing inconsistencies */
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
inconsistentSpacing(wordListPali, 'pali', 'spacing-inconsistencies-pali.txt')
