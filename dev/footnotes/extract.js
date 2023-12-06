"use strict"

const fs = require('fs')
const path = require('path')
const { writeHtml } = require('../word-list/common-functions.js')

const dataInputFolder = path.join(__dirname, '../../public/static/text/')

// select only mula or atta files
const isAtta = false, textSelection = new RegExp(isAtta ? '^(atta|anya)' : '^(?!(atta|anya))')
const inputFiles = fs.readdirSync(dataInputFolder).filter(name => /json$/.test(name)).filter(name => textSelection.test(name))
let numFootnotes = 0, numFiles = 0
const footnotes = []
inputFiles.forEach(filename => {
    const fileKey = filename.split('.')[0]
    const obj = JSON.parse(fs.readFileSync(path.join(dataInputFolder, filename)))
    obj.pages.forEach((p, pi) => {
        const sortKey = fileKey.replace(/\b\d+\b/g, match => match.padStart(2, '0'))
        p.pali.footnotes.forEach((e, ei) => footnotes.push([sortKey, fileKey, pi + 1, p.pageNum, ei + 1, e.text.replace(/\n/g, '[nl]')]))
    })
    numFiles++
})

const tbody = footnotes.sort((a, b) => a[0].localeCompare(b[0])).map(vals => `<td>${vals.join('</td><td>')}</td>`).join('</tr><tr>')
writeHtml(tbody, '../footnotes/footnotes')

console.log(`processed ${footnotes.length} entries from ${numFiles} files`)