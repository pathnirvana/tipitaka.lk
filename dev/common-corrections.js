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

const fileFilter = /atta-ap-yam/
const operation = 'attaCopyTitles'

const replaceHelper = (e, replaceFunc) => {
    const newText = replaceFunc(e.text)
    if (newText != e.text) {
        const lenDiff = e.text.length - newText.length
        e.text = newText
        return lenDiff
    }
    return 0
}

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
    attaCopyTitles: (data) => {
        let modCount = 0
        data.pages.forEach(p => p.sinh.entries.forEach((e, i) => {
            if (e.type == 'heading' && !e.text.trim()) {
                e.text = p.pali.entries[i].text
                modCount++
            }
        }))
        return modCount
    },

    multipleSpaces: (data) => {
        let modCount = 0
        const trimSpaces = (e) => replaceHelper(e, (text) => {
            return text.trim().replace(/ +/g, ' ')
        })
        data.pages.forEach(p => {
            p.pali.entries.forEach(e => modCount += trimSpaces(e))
            p.sinh.entries.forEach(e => modCount += trimSpaces(e))
        })
        return modCount
    },

    extraZWJRemove: (data) => {
        let modCount = 0
        const allZWJ = (e) => replaceHelper(e, (text) => text.replace(/\u200d/g, ''))
        const extraZWJ = (e) => replaceHelper(e, (text) => {
            let t = text.replace(/([^\u0dca])\u200d([^\u0dca])/g, '$1$2')
            return text.replace(/^\u200d/g, '').replace(/\u200d$/g, '')
        })
        data.pages.forEach(p => {
            p.pali.entries.forEach(e => modCount += allZWJ(e))
            p.sinh.entries.forEach(e => modCount += extraZWJ(e))
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