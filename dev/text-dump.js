/**
 * dump json files to text files - vincent uncle's academic requirement
 */
"use strict"

const fs = require('fs');
const path = require('path');
const sourceDir = path.join(__dirname, '../public/static/text') 
const outputDir = path.join(__dirname, 'text-dump')
let processedFilesCount = 0

const fileFilter = /vp|dn|mn|sn|an|kn|ap/


if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)
const filteredFiles = fs.readdirSync(sourceDir).filter(file => path.extname(file) == '.json' && fileFilter.test(file))
console.log(`selected ${filteredFiles.length} with filter ${fileFilter} for text dumping`)
//console.log(filteredFiles)
filteredFiles.forEach(file => processFile(file));
console.log(`processed ${processedFilesCount} files and wrote to ${outputDir}`)

function processFile(fullName) {
    const data = JSON.parse(fs.readFileSync(path.join(sourceDir, fullName), 'utf-8'))
    const langs = ['pali', 'sinh'], entries = {'pali': [], 'sinh': []}
    langs.forEach(lang => {
        const entries = [], outputName = `${fullName.slice(0, -5)}-${lang}.txt` // remove .json and add '-pali.txt'
        data.pages.forEach(p => {
            entries.push(...p[lang].entries)
        })
        fs.writeFileSync(path.join(outputDir, outputName), entries.map(e => e.text).join('\n'), 'utf-8')
    })
    processedFilesCount++
}