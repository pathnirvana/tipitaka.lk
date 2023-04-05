"use strict"
const fs = require('fs')
const path = require('path')
const vkb = require('vkbeautify')

function writeHtml(tbody, filePath) {
    fs.writeFileSync(path.join(__dirname, filePath + '.html'), 
        `<html>
            <head>
                <style>
                    a {text-decoration: none; padding-left: 10px; } 
                    table { border-collapse: collapse; }
                    table tr td { border: 0.5px solid gray; }
                    td { padding: 5px; }
                </style>
                <meta charset="utf-8"/>
            </head>
            <body style="font-family: 'UN-Abhaya';">
                <!--<div>වචනය උඩ click කිරීමෙන් ඒ වචනය ත්‍රිපිටකය තුල යෙදී ඇති ස්ථාන බලන්න</div>-->
                <table><tr>${tbody}</tr></table>    
            </body>
        </html>`, 'utf-8')
}

function readWordList(filename) { // read output from gen-word-list script
    const words = {}
    fs.readFileSync(path.join(__dirname, filename), 'utf-8').split('\n').forEach(l => {
        const entries = l.split('\t'), w = entries[0]
        words[w] = { word: w, freq: entries[1], length: w.length, info: JSON.parse(entries[2]) }
    })
    return words
}

/**
 * process all text files and write to corrected folder
 * operationFunc should modify the data object passed and return the count of modifications
 */
function processTextFiles(filterFunc, operationFunc, dryRun = false) {
    const sourceDir = path.join(__dirname, '../../public/static/text') 
    const outputDir = path.join(sourceDir, 'corrected'), modCounts = {}

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)
    const filteredFiles = fs.readdirSync(sourceDir)
        .filter(file => path.extname(file) == '.json' && filterFunc(file))
    //console.log(`selected ${filteredFiles.length} files for operation ${operationFunc}`)
    //console.log(filteredFiles)
    filteredFiles.forEach(file => {
        const data = JSON.parse(fs.readFileSync(path.join(sourceDir, file), 'utf-8'))
        const modCount = operationFunc(data, file)
        if (modCount > 0) {
            //console.log(`processed file ${file} with ${modCount} changes`)
            if (!dryRun) fs.writeFileSync(path.join(outputDir, file), vkb.json(JSON.stringify(data)), 'utf-8')
        }
        modCounts[file] = modCount
    })
    return modCounts
}

function getCstWordList() {
    const cstPath = '/Users/janaka/node/cst/dev/pali/freq-totals-mul.txt'
    const cstWords = []
    fs.readFileSync(cstPath, 'utf-8').split('\n').forEach(line => {
        const [w, freq, length, files] = line.trim().split(',')
        cstWords[w] = { freq, length, files }
    })
    return cstWords
}

module.exports = { readWordList, writeHtml, processTextFiles, getCstWordList } 