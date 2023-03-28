/** error check audio files */
"use strict"

const fs = require('fs');
const path = require('path');

function loadLabels(labelFile) {
    const data = fs.readFileSync(path.join(audioInputFolder, labelFile + '.txt'), 'utf-8')
    
    return data.split('\n').slice(0, -1) // removes the last empty line (for mac only \n)
        .map(line => {
            const [start, end, text] = line.trim().split('\t').map(n => Number(n))
            return {start, end, text, labelFile}; // 3 fields, start/end/num(starts at 1)
        }) 
}

const textInputFolder = path.join(__dirname, '../public/static/text/'),
    audioInputFolder = path.join(__dirname, '../public/audio'),
    fileMap = JSON.parse(fs.readFileSync(path.join(audioInputFolder, 'file-map.json'), 'utf-8')),
    countLabelFiles = Object.values(fileMap).reduce((a, labels) => a + labels.length, 0)

Object.entries(fileMap).forEach(([textFile, labelFiles]) => {
    const data = JSON.parse(fs.readFileSync(path.join(textInputFolder, textFile + '.json'))), entries = [], allLabels = {}
    data.pages.forEach(page => entries.push(...page.pali.entries.filter(e => !e.noAudio)))

    labelFiles.map(labelFile => allLabels[labelFile] = loadLabels(labelFile))
    const totalLabels = Object.values(allLabels).reduce((a, labels) => a + labels.length, 0)
    if (totalLabels != entries.length)
        console.error(`text: ${textFile}, total entries: ${entries.length}, does not equal total labels ${totalLabels}`)

    let nextLabel = 1
    labelFiles.forEach(labelFile => {
        const labels = allLabels[labelFile], startLabel = labels[0].text, endLabel = labels.slice(-1)[0].text
        if (labels.some(({start, end, text}) => [start, end, text].some(v => isNaN(v))))
            console.error(`labels: ${labelFile} has a non number field in one of start, end or label text`)
        if (startLabel != nextLabel) 
            console.error(`text: ${textFile}, labels: ${labelFile}, start label must be ${nextLabel} but found ${startLabel}`)
        if (endLabel - startLabel != labels.length - 1)
            console.error(`text: ${textFile}, labels: ${labelFile}, count labels: ${labels.length}, start/end: ${startLabel}/${endLabel} mismatch`)
        nextLabel = endLabel + 1
        if (!fs.existsSync(path.join(audioInputFolder, labelFile + '.m4a')))
            console.error(`audio file does not exist for label file: ${labelFile}`)
    })
})

console.log(`errors checked in ${Object.keys(fileMap).length} text files in ${audioInputFolder}. Total label files: ${countLabelFiles}`)