/**
 * read error checked files for common errors and make the corrections
 * empty: carry forward to next list - do nothing
 * c/m/d: create a list of correct words that will not be included in the subsequent lists
 * x: replace errorword with mainword
 */
"use strict"

const fs = require('fs')
const path = require('path')
const vkb = require('vkbeautify'), perf = require('perf_hooks').performance
const { processTextFiles } = require('../common-functions.js')
const checkedFilename = '10-sinh-joined-checked.txt'
const ignoreFilename = 'sinh-ignore.json', newIgnoreFilename = 'sinh-ignore-new.json'
const dryRun = false, writeIgnoreList = false

const ignoreWords = JSON.parse(fs.readFileSync(path.join(__dirname, ignoreFilename), 'utf-8')), replacements = {}
const input = fs.readFileSync(path.join(__dirname, checkedFilename), 'utf-8').split('\n').forEach((line, lineNum) => {
    const cells = line.split('\t').filter(c => c.trim()).map(cell => cell.match(/([\u0D80-\u0DFF\u200d!]+)\/(\d+)([mcdx]?)/)) // for pali need extra \/\d+
    //console.log(cells)
    if (cells.some(m => !m) || !cells[0] || !cells.slice(1)) console.error(`malformed line in ${checkedFilename} ${line} at line ${lineNum}`)
    const mainWord = cells[0][1]
    //if (!cells.slice(1)) console.log(cells)
    cells.slice(1).forEach(([_1, word, freq, action]) => {
        if (['c', 'm', 'd'].indexOf(action) >= 0) ignoreWords[word] = action
        else if (['x'].indexOf(action) >= 0) {
            if (replacements[word] && replacements[word].mainWord != mainWord) 
                console.error(`replacement for this word ${word} already defined -> ${replacements[word].mainWord}/${mainWord}`)
            replacements[word] = { mainWord, freq, done: 0 }
        }
    })    
})
if (!dryRun && writeIgnoreList)
    fs.writeFileSync(path.join(__dirname, newIgnoreFilename), vkb.json(JSON.stringify(ignoreWords)), 'utf-8')
console.log(`wrote new ignore list with ${Object.keys(ignoreWords).length} words to ${newIgnoreFilename}`)

console.log(`needs to do ${Object.keys(replacements).length} replacements`)

function makeReplacements(data) {
    let modCount = 0
    const replaceFunc = (e) => {
        e.text = e.text.replace(/[\u0D80-\u0DFF\u200d]+/g, (m) => {
            const info = replacements[m]
            if (info) {
                info.done++
                modCount++
                return info.mainWord
            }
            return m
        })
    }
    data.pages.forEach(p => {
        //p.pali.entries.forEach(e => replaceFunc(e))
        p.sinh.entries.forEach(e => replaceFunc(e))
    })
    return modCount
}

const perf1 = perf.now()
const modCounts = processTextFiles(file => !/^atta/.test(file), (data, file) => makeReplacements(data), dryRun)
const considered = Object.keys(modCounts).length, changed = Object.values(modCounts).filter(v => v).length
console.log(`changed ${changed} files out of ${considered} files, in ${perf.now() - perf1} mills`)

Object.entries(replacements).filter(([w, info]) => info.done != info.freq).forEach(([w, info]) => console.log(`${w} freq ${info.freq}, but found ${info.done} places to replace`))
if (!dryRun)
    fs.writeFileSync(path.join(__dirname, '10-done-replacements.json'), vkb.json(JSON.stringify(replacements)), 'utf-8')