const fs = require('fs')
const path = require('path')

// need to restart the server on changes to tree.json to pickup the changes
const titleIndex = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/static/data/tree.json'), 'utf-8'))
const paliLinks = Object.keys(titleIndex).map(key => `https://tipitaka.lk/${key}/pali`)
const sinhLinks = Object.keys(titleIndex).map(key => `https://tipitaka.lk/${key}/sinh`)

// TODO add dict/fts/title search page for most common searches
const ftsLinks = ['https://tipitaka.lk/fts/මාරයා/0-0-10']

const allLinks = paliLinks.concat(sinhLinks, ftsLinks)
console.log(`writing ${allLinks.length} links to sitemap`)
fs.writeFileSync(path.join(__dirname, '../public/static/sitemap.txt'), allLinks.join('\n'), 'utf-8')