/**
 * makes corections to the json text files that are hard to do via find-replace
 */
"use strict"

const fs = require('fs');
const path = require('path');
const vkb = require('vkbeautify')
const { readWordList } = require('./common-functions.js')

const sourceDir = path.join(__dirname, '../../public/static/text') 
const outputDir = path.join(sourceDir, 'corrected')
let processedFilesCount = 0

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

function processFile(fullName) {
    const data = JSON.parse(fs.readFileSync(path.join(sourceDir, fullName), 'utf-8'))
    const modCount = operationsList[operation](data)
    if (modCount > 0) {
        //console.log(`processed file ${fullName} with ${modCount} changes with ${operation}`)
        fs.writeFileSync(path.join(outputDir, fullName), vkb.json(JSON.stringify(data)), 'utf-8')
        processedFilesCount++
    }
}

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)
const filteredFiles = fs.readdirSync(sourceDir)
    .filter(file => path.extname(file) == '.json' && !/^atta/.test(file))
console.log(`selected ${filteredFiles.length} files for operation ${operation}`)
//console.log(filteredFiles)
filteredFiles.forEach(file => processFile(file));
console.log(`processed ${processedFilesCount} files and wrote to ${outputDir}`)

Object.values(piList).forEach(v => {
    if (v.replacements != v.info['q-or-s']) console.log(`desired: ${v.info['q-or-s']}, actual: ${v.replacements} for ${v.word}`)
})