/**
 * makes ending corections to the json text files 
 * that are hard to do via find-replace
 */
"use strict"

const fs = require('fs');
const path = require('path');
const { readWordList, processTextFiles } = require('../common-functions.js')

const operation = 'piWordsReplace'
const piList = readWordList('word-list-pi-q-or-s.txt')
Object.values(piList).map(v => v.replacements = 0)


const operationsList = {
    piWordsReplace: (data) => {
        let modCount = 0
        const replaceFunc = (e) => {
            let countRep = 0
            e.text = e.text.replace(/([\u0D80-\u0DFF]+)[ ’]පි([,\. ])/g, (m, p1, p2, _offset, text) => {
                //if (p1=='රාජා') console.log(text)
                const w = p1 + 'පි'
                if (piList[w]) {
                    piList[w].replacements++
                    countRep++
                    return w + p2
                }
                return m // no change
            })
            return countRep
        }
        data.pages.forEach(p => {
            p.pali.entries.forEach(e => modCount += replaceFunc(e))
            p.sinh.entries.forEach(e => modCount += replaceFunc(e))
        })
        return modCount
    },

}

const modCounts = processTextFiles(file => !/^atta/.test(file), (data, file) => operationsList.piWordsReplace(data))
console.log(`processed ${modCounts} files`)

Object.values(piList).forEach(v => {
    if (v.replacements != v.info['q-or-s']) console.log(`desired: ${v.info['q-or-s']}, actual: ${v.replacements} for ${v.word}`)
})