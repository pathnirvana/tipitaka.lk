"use strict"

const fs = require('fs');
const path = require('path');
const SqliteDB = require('../server/sql-query.js');

/*
DROP TABLE IF EXISTS tipitaka;
CREATE VIRTUAL TABLE tipitaka USING fts5(filename, eind, language, type, level, text, 
    tokenize = "unicode61 tokenchars '' seperators '()[]:'");
SELECT filename, eind, language, highlight(tipitaka, 5, '<b>', '</b>') AS htext FROM tipitaka 
    WHERE text MATCH 'NEAR(අභික්කන්තවණ්ණා තෙනුපසඞ්කමි, 10)';
    WHERE tipitaka MATCH '(text:NEAR(අභික්කන්තවණ්ණා තෙනුපසඞ්කමි, 10)) AND (filename:"an-6" OR "sn-1")' ;
optionally (filename LIKE 'an-6%' OR filename LIKE 'sn-1%') would also work - this seems faster
*/
// for some reason these statements do not succeed when running from js
/*const sinhalaRange = [] // use as tokenchars
for (let i = 0x0d80; i < 0x0dff; i++) sinhalaRange.push(String.fromCharCode(i))
console.log(`DROP TABLE IF EXISTS tipitaka;`)
console.log(`CREATE VIRTUAL TABLE tipitaka USING fts5(filename, eind, language, type, level, text, 
        tokenize = "unicode61 tokenchars '${sinhalaRange.join('')}' separators '()[]:'");`)
process.exit(0)*/

function writeEntry(e, eind, lang, fileKey) {
    let text = e.text.replace(/\*|_|~|\$|\{\d\}|\u200d/g, '') // zwj and footnote pointers
    if (writeFtsDb) {
        ftsDb.db.run('INSERT INTO tipitaka (filename, eind, language, type, level, text) VALUES (?, ?, ?, ?, ?, ?)', 
            [fileKey, eind.join('-'), lang, e.type, e.level || 0, text]);
    }
    
    if (writeSuggestedWords) {
        const wordList = (lang == 'pali') ? wordListPali : wordListSinh
        text = text.replace(/[\.\:\[\]\(\)\{\}\-–,\d'"‘’“”\?\n\t\r]/g, ' ') // replace with spaces
        text.split(' ').forEach(word => {
            if (!word.trim().length) return
            if (wordList[word]) {
                wordList[word]++
            } else {
                wordList[word] = 1
            }
        })
    }
    numEntries++
}

const writeFtsDb = true, writeSuggestedWords = false
const wordListPali = [], wordListSinh = []
const dataInputFolder = path.join(__dirname, '../public/static/text/')
const ftsDictFile = path.join(__dirname, '../server/fts.db')
const ftsDb = new SqliteDB(ftsDictFile, true)
if (writeFtsDb) {
    ftsDb.db.run('BEGIN')
    ftsDb.db.run('DELETE FROM tipitaka')
}

const inputFiles = fs.readdirSync(dataInputFolder).filter(name => /json$/.test(name))
let numEntries = 0, numFiles = 0
inputFiles.forEach(filename => {
    const fileKey = filename.split('.')[0]
    const obj = JSON.parse(fs.readFileSync(path.join(dataInputFolder, filename)))
    obj.pages.forEach((p, pi) => {
        p.pali.entries.forEach((e, ei) => writeEntry(e, [pi, ei], 'pali', fileKey))
        p.sinh.entries.forEach((e, ei) => writeEntry(e, [pi, ei], 'sinh', fileKey))
    })
    numFiles++
})

if (writeFtsDb) {
    ftsDb.run('COMMIT')
    ftsDb.close();
    console.log(`added ${numEntries} entries from ${numFiles} to ftsDB`)
}

const writeWordList = (wordList, filePath) =>
    fs.writeFileSync(path.join(__dirname, filePath), 
    Object.keys(wordList).map(w => [w, wordList[w]]).sort((a, b) => b[1] - a[1]).map(ar => ar.join(','))
    .join('\n'), 'utf-8')
if (writeSuggestedWords) {
    writeWordList(wordListPali, '../server/word-list-pali.csv')
    writeWordList(wordListSinh, '../server/word-list-sinh.csv')
    console.log(`wrote ${numEntries} entries from ${numFiles} to word list`)
}