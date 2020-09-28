const fs = require('fs')
const path = require('path')

// need to restart the server on changes to tree.json to pickup the changes
const titleIndex = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/static/data/tree.json'), 'utf-8'))
const paliLinks = Object.keys(titleIndex).map(key => `https://tipitaka.lk/${key}/pali`)
const sinhLinks = Object.keys(titleIndex).map(key => `https://tipitaka.lk/${key}/sinh`)

// TODO add dict/fts/title search page for most common searches
commonSearchTerms = ['කර්මය', 'මාරයා', 'ශ්‍රද්ධාව', 'පංචඋපාදානස්කන්ධය', 'සංඛාර', 'නාමරූප', 'අරූප ලෝක', 'ආනන්තරීය කර්ම', 'සෝවාන් පුද්ගලයා',
    'ත්‍රිහේතුක ප්‍රතිසන්ධිය', 'පටිච්චසමුප්පාදය']
const ftsLinks = commonSearchTerms.map(term => `https://tipitaka.lk/fts/${term}/0-0-10`)

const allLinks = paliLinks.concat(sinhLinks, ftsLinks)
console.log(`writing ${allLinks.length} links to sitemap`)
fs.writeFileSync(path.join(__dirname, '../public/static/sitemap.txt'), allLinks.join('\n'), 'utf-8')