"use strict"
const fs = require('fs');
const path = require('path');

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
                <h2>වචනය උඩ click කිරීමෙන් ඒ වචනය ත්‍රිපිටකය තුල යෙදී ඇති ස්ථාන බලන්න</h2>
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

module.exports = { readWordList, writeHtml } 