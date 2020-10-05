/**
 * makes corections to the json text files that are hard to do via find-replace
 */
"use strict"

const fs = require('fs');
const path = require('path');
const vkb = require('vkbeautify')
const sourceDir = path.join(__dirname, '../public/static/text') 
const outputDir = path.join(sourceDir, 'corrected')
let processedFilesCount = 0

const fileFilter = /atta/
const operation = 'attaFootnotes'

const operationsList = {
    format: (data) => {
        let modCount = 0
        data.pages.forEach(p => p.sinh.entries.forEach(e => {
            if ('format' in e) {
                delete e.format
                modCount++
            }
        }))
        return modCount
    },

    attaFootnotes: (data) => {
        let modCount = 0
        data.pages.forEach(p => {
            const footnotes = [], dedupFootnotes = {}
            p.sinh.entries.forEach(e => extractFootnotes(e, footnotes, dedupFootnotes))
            if (footnotes.length) {
                if (p.sinh.footnotes.length) console.error(`page ${p.pageNum} already has footnotes`)
                p.sinh.footnotes = footnotes
                modCount += footnotes.length
                //console.log(footnotes)
            }
        })
        return modCount
    },

    multipleSpaces: (data) => {
        let modCount = 0
        const trimSpaces = (e) => {
            let newText = e.text.trim()
            newText = newText.replace(/ +/g, ' ')
            if (newText != e.text) {
                const lenDiff = e.text.length - newText.length
                e.text = newText
                return lenDiff
            }
            return 0
        }
        data.pages.forEach(p => {
            p.pali.entries.forEach(e => modCount += trimSpaces(e))
            p.sinh.entries.forEach(e => modCount += trimSpaces(e))
        })
        return modCount
    },

}

function extractFootnotes(entry, footnotes, dedupFootnotes) {
    entry.text = entry.text.replace(/\{[\. ]*([^\{\}]{3,})\}/g, (match, p1) => { // only >= 3 letters long
        p1 = p1.trim()
        const ref = dedupFootnotes[p1] || footnotes.length + 1
        if (!dedupFootnotes[p1]) footnotes.push({ type: 'footnote', text: ref + '. ' + p1 })
        dedupFootnotes[p1] = ref
        return `{${ref}}`
    })
}


if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)
const filteredFiles = fs.readdirSync(sourceDir).filter(file => path.extname(file) == '.json' && fileFilter.test(file))
console.log(`selected ${filteredFiles.length} with filter ${fileFilter} and operation ${operation}`)
//console.log(filteredFiles)
filteredFiles.forEach(file => processFile(file));
console.log(`processed ${processedFilesCount} files and wrote to ${outputDir}`)

function processFile(fullName) {
    const data = JSON.parse(fs.readFileSync(path.join(sourceDir, fullName), 'utf-8'))
    const modCount = operationsList[operation](data)
    if (modCount > 0) {
        console.log(`processed file ${fullName} with ${modCount} changes with ${operation}`)
        fs.writeFileSync(path.join(outputDir, fullName), vkb.json(JSON.stringify(data)), 'utf-8')
        processedFilesCount++
    }
}