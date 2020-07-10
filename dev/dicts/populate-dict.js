/**
* read json files and populate the all dict db
* Also read the breakup db too
*/
const fs = require('fs');
const vkb = require('vkbeautify')
const path = require('path')
const SqliteDB = require('../../server/sql-query.js')
//const { dictionaryInfo } = require('../../src/constants.js')

const dictionaryList = new Map([
    ['en-buddhadatta', 'BUE'],
    ['en-nyanatiloka', 'ND'],
    ['en-pts', 'PTS'],
    ['en-dppn', 'PN'],
    ['en-vri', 'VRI'],
    ['en-critical', 'CR'],
    
    ['si-buddhadatta', 'BUS'],
    ['si-sumangala', 'MS'],
])

const dataInputFolder = path.join(__dirname, 'dict-input')
const inputFiles = fs.readdirSync(dataInputFolder).map(name => name.split('.')[0])
let allWords = []
let meaningsProcessed = 0

inputFiles.forEach(dictName => {
    const data = JSON.parse(fs.readFileSync(path.join(dataInputFolder, dictName + '.json')))
    const shortName = dictionaryList.get(dictName)
    data.forEach(([word, meaning]) => {
        if (shortName == 'CR') meaning = removeBRTags(meaning)
        word = word.replace(/\d$/, '') // some words have ending numbers
        allWords.push([word, shortName, meaning])
    })
    meaningsProcessed += data.length
})

const breakupsAr = JSON.parse(fs.readFileSync(path.join(__dirname, 'breakups.json')))
//console.log(breakupsAr.filter(row => row[3].length > 1).length)
breakupsAr.forEach(([word, type, origin, breakups]) => {
    breakups.forEach(br => {
        if (!br[0]) console.log(breakups)
        allWords.push([word, 'BR', type + '|' +br[0]]) // add type to meaning so that it can be extracted
    })
})
meaningsProcessed += breakupsAr.length

allWords = allWords.sort((a, b) => a[0] > b[0]).filter(row => row.every(col => col)) // sort and remove null meanings
console.log(`total words ${allWords.length} - total meanings ${meaningsProcessed}`)
fs.writeFileSync(path.join(__dirname, 'all-words.json'), vkb.json(JSON.stringify(allWords)), 'utf-8')

const dbFilebase = 'dict.db'
const dbFilePath = path.join(__dirname, '../../server/', dbFilebase)
writeToSqlite().then(() => console.log(`wrote to sqlite db ${dbFilebase}`))

// write to sqlite db
async function writeToSqlite() {
    const dictDb = new SqliteDB(dbFilePath, true).run('BEGIN');
    await dictDb.runAsync('DROP TABLE IF EXISTS dictionary;');
    await dictDb.runAsync('DROP INDEX IF EXISTS worddict;');
    await dictDb.runAsync('CREATE TABLE dictionary (word TEXT NOT NULL, dict TEXT NOT NULL, meaning TEXT NOT NULL);');
    await dictDb.runAsync('CREATE INDEX worddict ON dictionary(word, dict);');
    allWords.forEach(([word, dict, meaning]) => {
        dictDb.run('INSERT INTO dictionary (word, dict, meaning) VALUES (?, ?, ?)', [word, dict, meaning]);
    });
    dictDb.run('COMMIT').close();
}

function removeBRTags(meaning) {
    meaning = meaning.replace(/-<br\/>/g, '') // no space - join words
    return meaning.replace(/<br\/>/g, ' ') // space
}