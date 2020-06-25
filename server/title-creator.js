const fs = require('fs')
const path = require('path')

// need to restart the server on changes to tree.json to pickup the changes
const titleIndex = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/static/data/tree.json'), 'utf-8'))

//text = text.replace(/\u0DCA([\u0DBA\u0DBB])/g, '\u0DCA\u200D$1');
const urlRegex = RegExp('^/([^/]+)/?([^/]*)/?([^/]*)/?$')
function getTitle(url) {
    const m = urlRegex.exec(url)
    if (!m) {
        console.log(`no match for index url ${url}`)
        return ''
    }
    const item = titleIndex[m[1]]
    if (item) {
        const lang = (m[3] || m[2] || 'pali') == 'pali' ? 0 : 1
        const keyRoot = m[1].split('-')[0]
        const rootName = (keyRoot != m[1]) ? ' < ' + titleIndex[keyRoot][lang] : ''
        return item[lang] + rootName
    } else if (m[1] == 'fts') {
        return m[2] ? `“${m[2]}” යන අන්තර්ගත සෙවුම සඳහා ලැබුණු ප්‍රතිඵල` : 'සූත්‍ර අන්තර්ගතය සෙවීම' 
    } else if (m[1] == 'dict') {
        return m[2] ? `“${m[2]}” යන ශබ්දකෝෂ සෙවුම සඳහා ලැබුණු ප්‍රතිඵල` : 'පාළි ශබ්දකෝෂ සෙවීම'
    } else if (m[1] == 'title') {
        return m[2] ? `“${m[2]}” යන සූත්‍ර නම් සෙවීම සඳහා ලැබුණු ප්‍රතිඵල` : 'සූත්‍ර නම් සෙවීම'
    }
    console.log(`no match for the route ${url}`)
    return ''
}

// test the getTitle function for various urls
const printTitle = (url) => console.log(`${url} => ${getTitle(url)}`)
function runTests() {
    printTitle('/')
    printTitle('/dn')
    printTitle('/dn-1-2/sinh')
    printTitle('/mn-3-3-3/1-1/sinh')
    printTitle('/mn-3-3-3/pali')
    printTitle('/fts/ජන/0-0-10')
    printTitle('/fts/ජන්තාඝරපීඨං/')
    printTitle('/dict/ජන්තාඝරපීඨං')
    printTitle('/dict/')
    printTitle('/title/janaka')
}
//runTests()

module.exports = getTitle