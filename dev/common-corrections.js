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

const fileFilter = /./g
const operation = 'format'
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)
const filteredFiles = fs.readdirSync(sourceDir).filter(file => path.extname(file) == '.json' && fileFilter.test(file))
console.log(`selected ${filteredFiles.count} with filter ${fileFilter} and operation ${operation}`)
//console.log(filteredFiles)
filteredFiles.forEach(file => processFile(file));
console.log(`processed ${processedFilesCount} files and wrote to ${outputDir}`)

function processFile(fullName) {
    const data = JSON.parse(fs.readFileSync(path.join(sourceDir, fullName), 'utf-8'))
    const modCount = format(data)
    if (modCount > 0) {
        console.log(`processed file ${fullName} with ${modCount} changes with ${operation}`)
        fs.writeFileSync(path.join(outputDir, fullName), vkb.json(JSON.stringify(data)), 'utf-8')
        processedFilesCount++
    }
}

function format(data) {
    let modCount = 0
    data.pages.forEach(p => p.sinh.entries.forEach(e => {
        if ('format' in e) {
            delete e.format
            modCount++
        }
    }))
    return modCount
}