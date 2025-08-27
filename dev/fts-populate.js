"use strict"

const fs = require('fs');
const path = require('path');
const SqliteDB = require('../server/sql-query.js');

/*
DROP TABLE IF EXISTS tipitaka;
FTS 5 - not available in android
CREATE VIRTUAL TABLE tipitaka USING fts4(filename, eind, language, type, level, text, 
    tokenize = "unicode61 tokenchars '' seperators '()[]:'");
SELECT filename, eind, language, highlight(tipitaka, 5, '<b>', '</b>') AS htext FROM tipitaka 
    WHERE text MATCH 'NEAR(අභික්කන්තවණ්ණා තෙනුපසඞ්කමි, 10)' AND (filename LIKE 'an-6%' OR filename LIKE 'sn-1%');

FTS 4
CREATE VIRTUAL TABLE tipitaka USING fts4(filename, eind, language, type, level, text, 
    tokenize = unicode61 "tokenchars=" " seperators=()[]:");
SELECT filename, eind, language, snippet(tipitaka, '<b>', '</b>', '...', 5) AS htext FROM tipitaka 
    WHERE text MATCH 'අභික්කන්තවණ්ණා NEAR තෙනුපසඞ්කමි' AND filename LIKE 'an-%';
*/
// for some reason these statements do not succeed when running from js
// so have to run from "DB Browser for SqlLite"
// const sinhalaRange = [] // use as tokenchars
// for (let i = 0x0d80; i < 0x0dff; i++) sinhalaRange.push(String.fromCharCode(i))
// console.log(`DROP TABLE IF EXISTS tipitaka;`)
// console.log(`CREATE VIRTUAL TABLE tipitaka USING fts4(filename, eind, language, type, level, text, 
//         tokenize = unicode61 "tokenchars=${sinhalaRange.join('')}" "separators=()[]:");`)
// process.exit(0)

function writeEntry(e, eind, lang, fileKey) {
    let text = e.text.replace(/[\*_~\$\u200d]|\{\S{0,2}\}/g, '') // zwj and footnote pointers
    text = text.replace(/\n/g, ' ') // looks like newline prevents matches for words bordering the newline
    text = text.trim();

    if (writeFtsDb) {
        ftsDb.run('INSERT INTO tipitaka (filename, eind, language, type, level, text) VALUES (?, ?, ?, ?, ?, ?)', 
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

//Moved the table creation logic in to a function. 
function createVirtualTable() {
    if (writeFtsDb) {
        ftsDb.run('BEGIN');
        ftsDb.run('DROP TABLE IF EXISTS tipitaka')
        const sinhalaRange = [];
        for (let i = 0x0d80; i <= 0x0dff; i++) {
            sinhalaRange.push(String.fromCharCode(i));
        }

        const createVirtualTableSQL = `CREATE VIRTUAL TABLE IF NOT EXISTS tipitaka USING fts4(
            filename, eind, language, type, level, text, 
            tokenize = unicode61 "tokenchars='${sinhalaRange.join('')}'"
        );`;

        ftsDb.run(createVirtualTableSQL);
        ftsDb.run('COMMIT');
    }
}

const writeFtsDb = true, writeSuggestedWords = false
const wordListPali = [], wordListSinh = []
const dataInputFolder = path.join(__dirname, '../public/static/text/')
const ftsDictFile = path.join(__dirname, '../server/fts.db')
const ftsDb = new SqliteDB(ftsDictFile, true)

// Table creation and data insertion had to seperated in to two transactions, in order to work.
// Uncomment the call to createVirtualTable() and the return statement first time.
// Once the table is created, comment this block and run the script again to insert data.
// if you're getting errors, just try step over in debugging mode from ftsDb.run('BEGIN') to ftsDb.run('COMMIT'). Strange!

// createVirtualTable();
// return;

if (writeFtsDb) {
   ftsDb.run('BEGIN');
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
    ftsDb.run('VACUUM') // reclaim unused space in db file
    ftsDb.close();
    console.log(`added ${numEntries} entries from ${numFiles} files to ftsDB`)
}

const writeWordList = (wordList, filePath) =>
    fs.writeFileSync(path.join(__dirname, filePath), 
    Object.keys(wordList).map(w => [w, wordList[w]]).sort((a, b) => b[1] - a[1]).map(ar => ar.join(','))
    .join('\n'), 'utf-8')
if (writeSuggestedWords) {
    writeWordList(wordListPali, 'obsolete/word-list-pali.csv')
    writeWordList(wordListSinh, 'obsolete/word-list-sinh.csv')
    console.log(`wrote ${numEntries} entries from ${numFiles} to word list`)
}