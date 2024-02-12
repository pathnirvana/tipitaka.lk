/**
 * makes corections to the json text files that are hard to do via find-replace
 */
"use strict"

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vkb = require('vkbeautify')
const sourceDir = path.join(__dirname, '../../public/static/text') 
const outputDir = path.join(sourceDir, 'fnreplaced')
const checkedFilename = 'footnotes-checked.txt'

if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true })
fs.mkdirSync(outputDir)

function writeFile(data, filename, modsCount) {
    const outputFile = path.join(outputDir, filename + '.json')
    assert(!fs.existsSync(outputFile), `output file ${filename} already exists in ${outputDir}`)
    //fs.writeFileSync(outputFile, vkb.json(JSON.stringify(data)), 'utf-8')
    //console.log(`wrote file ${filename} with ${modsCount} modifications`)
    processedFilesCount++
}

let processedFilesCount = 0, processedLinesCount = 0
let curOpenFile = '', data = '', modsCount = 0
//each line in checked file = --, json file, json page, pdf page, index, text
fs.readFileSync(path.join(__dirname, checkedFilename), 'utf-8').split('\n').forEach((line, lineNum) => {
    let [_1, file, page, _2, fnIndex, newText] = line.split('\t').map(c => c.trim())
    assert(file && page && fnIndex && newText, `malformed line in checked file ${line} line ${lineNum}`)

    if (curOpenFile != file) {
        if (data && modsCount) writeFile(data, curOpenFile, modsCount)
        data = JSON.parse(fs.readFileSync(path.join(sourceDir, file + '.json'), 'utf-8'))
        curOpenFile = file
        modsCount = 0
    }
    assert(data.filename == file, `opened filename ${data.filename} does not match processing file ${file}`)
    const footnotes = data.pages[page - 1].pali.footnotes, footnote = footnotes[fnIndex - 1]
    assert(footnote, `footnote ${fnIndex} does not exist to overwrite for ${line} line ${lineNum}`)

    //if (/^\d+$/.test(newText)) newText = newText + '.' // ending . has been removed by google sheets for empty footnotes
    //if (!/^(\d+|\*|†|[a-z])\./.test(newText)) console.error(`malformed new text ${newText}`)
    if (newText.length < 4 && footnote.text.length > 5) console.error(`possibly deleted new text ${newText} and ${footnote.text}`)
    const parts = newText.split(';')
    if (parts.length >= 2 && parts.some(p => p.split('–').length != 2)) console.error(`line ${lineNum}: ${newText}`) 
    footnote.text = newText.replace(/\[nl\]/g, '\n')
    modsCount++
    processedLinesCount++
})

if (data && modsCount) writeFile(data, curOpenFile, modsCount) // write the last file

console.log(`processed ${processedFilesCount} files and ${processedLinesCount} lines`)
