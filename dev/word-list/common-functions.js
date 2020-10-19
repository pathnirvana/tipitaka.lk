"use strict"
const fs = require('fs');
const path = require('path');

function writeHtml(tbody, filePath) {
    fs.writeFileSync(path.join(__dirname, filePath + '.html'), 
        `<html><head><style>
            a {text-decoration: none; padding-left: 10px; } 
            table { border-collapse: collapse; }
            table tr td { border: 0.5px solid gray; }
            td { padding: 5px; }
        </style></head>
        <body style="font-family: 'UN-Abhaya';">
            <table><tr>${tbody}</tr></table>    
        </body></html>`, 'utf-8')
}

module.exports = { writeHtml } 