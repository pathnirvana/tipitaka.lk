"use strict"

const fs = require('fs')
const path = require('path')
const { readWordList, writeHtml } = require('../common-functions.js')

const words = readWordList('word-list-sinh.txt')
//console.log(words['අකාන්ත'])
const input  = fs.readFileSync(path.join(__dirname, 'add-links-input.txt'), 'utf-8').split('\n')

const tbody = input.map(w => [w.trim(), w.trim().replace(/\u200d/g, '')])
    .map(([w, t]) => `<td>${words[t] ? words[t].freq : 0}</td><td><a href="https://tipitaka.lk/fts/${w.replace(/ /g, '%20')}/1-1-10">${w}</a></td>`).join('</tr>\n<tr>')
writeHtml(tbody, 'hard-words/add-links-output.html')