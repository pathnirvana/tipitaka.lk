/**
 * error check the mula pali/sinh side footnotes
 * footnotes which are underlined should be ignored - they are in the scan but not used in the text
 */
"use strict"

const fs = require('fs')
const path = require('path')
const { writeHtml } = require('../word-list/common-functions.js')
const vkb = require('vkbeautify')

const textInputFolder = path.join(__dirname, '../../public/static/text/'), dataInputFolder = path.join(__dirname, '../../public/static/data/')
const abbreOrig = JSON.parse(fs.readFileSync(path.join(dataInputFolder, 'footnote-abbreviations.json'), 'utf-8')),
    abbreClean = {}
Object.entries(abbreOrig).forEach(([k, v]) => {
    abbreClean[k.replace(/\u200d/g, '')] = k 
    abbreOrig[k][1] = 0
})

const isNumeric = (str) => !Number.isNaN(Number(str))

// select only mula or atta files
const isAtta = false, textSelection = new RegExp(isAtta ? '^(atta|anya)' : '^(?!(atta|anya))'), lang = 'pali'
const inputFiles = fs.readdirSync(textInputFolder).filter(name => /json$/.test(name)).filter(name => textSelection.test(name))

let numFootnotes = 0, numFiles = 0, numErrors = 0
const errorList = [], foundAbbre = {}, notFoundAbbre = {}

inputFiles.forEach(filename => {
    const fileKey = filename.split('.')[0]
    const obj = JSON.parse(fs.readFileSync(path.join(textInputFolder, filename)))
    obj.pages.forEach((p, pi) => {
        const sortKey = fileKey.replace(/\b\d+\b/g, match => match.padStart(2, '0'))
        errorCheck(p[lang].entries, p[lang].footnotes, [fileKey, pi, p.pageNum])
        numFootnotes += p[lang].footnotes.length
    })
    numFiles++
})

function errorCheck(entries, oFootnotes, location) {
    const footnotes = {}, refs = {}
    oFootnotes.forEach(f => {
        if (f.type != 'footnote') reportError('wrong type', location, f)
        const match = f.text.match(/^(\d+|\*|†|‡|[a-z])\.([\s\S]*)$/)
        if (!match) {
            reportError('malformed', location, f)
            return
        }
        let [, pointer, content] = match
        if (!content.startsWith(' ')) reportError('space after pointer needed', location, f)
        content = content.trim()
        if (!content) reportError('empty footnote', location, f)
        if (content.startsWith('*') && !content.startsWith('**')) reportError('starts with *', location, f)
        if (footnotes[pointer]) reportError(`duplicate pointer ${pointer}`, location, f)
        const pNum = parseInt(pointer)
        if (!isNaN(pNum) && pNum > 1 && !footnotes[pNum - 1]) reportError(`out of order ${pNum - 1} not found yet`, location, f)
        countAbbreviations(content)
        footnotes[pointer] = { footnote: f, used: 0, content, underlined: content.startsWith('__') }
    })
    entries.forEach(e => {
        if (e.type == 'footnote') reportError('wrong entry type', location, '', e)
        const regex = /\**\{(.*?)\}/g
        let match;
        while ((match = regex.exec(e.text)) !== null) {
            const pointer = match[1].trim()
            if (match[0].startsWith('*') && !match[0].startsWith('**')) reportError(`* before ref ${pointer}`, location, '', e)
            if (!pointer.trim() || pointer.length > 2) reportError(`malformed ref ${pointer}`, location, '', e)
            else {
                const pNum = parseInt(pointer)
                if (!isNaN(pNum) && pNum > 1 && !refs[pNum - 1] && !(footnotes[pNum - 1] && footnotes[pNum - 1].underlined)) reportError(`out of order ref, ${pNum - 1} not used yet`, location, '', e)
                if (!footnotes[pointer]) {
                    reportError(`footnote not found for ref ${pointer}`, location, '', e)
                } else {
                    footnotes[pointer].used++
                }
                refs[pointer] = e
            }
        }
    })
    // footnotes which are underlined should be ignored - they are in the scan but not used in the text
    Object.values(footnotes).filter(({used, underlined}) => !used && !underlined).forEach(value => reportError(`not used in text`, location, value.footnote))
}

function countAbbreviations(content) {
    const abbre = content.replace(/\.$/, '').split(';').map(p => p.split('–')).filter(va => va.length == 2).map(va => va[1].split(',')).flat()
        .map(a => a.trim()).filter(a => a.length < 20 && !a.match(/_/))
    abbre.forEach(a => {
        foundAbbre[a] = (foundAbbre[a] || 0) + 1
        if (!abbreClean.hasOwnProperty(a)) {
            notFoundAbbre[a] = (notFoundAbbre[a] || 0) + 1
        } else {
            const ao = abbreClean[a]
            abbreOrig[ao][1]++
        }
    })
    
}

function reportError(message, [fileKey, pi, pageNum], footnote, entry) {
    const fm = footnote ? footnote.text.substring(0, 20) : '', eStr = entry ? entry.text.substring(0, 20) : ''
    errorList.push([fileKey, pi + 1, pageNum, message, fm, eStr])
    //console.error(`${message} ${fm} at file: ${fileKey}, pdf page: ${pageNum}, json page: ${pi + 1}`)
    //numErrors++
}

const tbody = errorList.sort((a, b) => a[0].localeCompare(b[0])).map(vals => `<td>${vals.join('</td><td>')}</td>`).join('</tr><tr>')
writeHtml(tbody, `../footnotes/footnote-errors-${lang}`)
console.log(Object.entries(notFoundAbbre).sort(([a1, c1], [a2, c2]) => c2 - c1).map(([a, c]) => `${a}: ${c}`).join('\n'))
fs.writeFileSync(path.join(dataInputFolder, 'footnote-abbreviations-new.json'), vkb.json(JSON.stringify(abbreOrig)), 'utf-8')
console.log(`number of unique abbre total: ${Object.keys(foundAbbre).length}, not found: ${Object.keys(notFoundAbbre).length}`)

console.log(`checked ${numFootnotes} footnotes from ${numFiles} files. Number of errors found: ${errorList.length}`)