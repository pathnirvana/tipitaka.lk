/**
 * Read the data files and create the tree and the sutta name search index
 */

const fs = require('fs');
const vkb = require('vkbeautify')

// the base tree - need to be built manually. can be read from a json file
const TFI = Object.freeze({
    Name: 0,
    Sinhala: 1,
    Level: 2,
    EntryInd: 3,
    Parent:  4,
    Filename: 5,
});
const tree = {
    'vp': [ 'විනයපිටක', '', 7, 0, 'root', ''],
    'sp': [ 'සුත්තපිටක', 'සූත්‍ර පිටකය', 7, 0, 'root', ''],
    'ap': [ 'අභිධර්මපිටක', '', 7, 0, 'root', ''],

    'dn': [ 'දීඝනිකාය', 'දික් සඟිය', 2, 0, 'sp', 'dn-1-1'],
    'mn': [ 'මජ්ඣිමනිකාය', '', 6, 0, 'sp', 'mn-1-1'],
    'sn': [ 'සංයුත්තනිකාය', '', 6, 0, 'sp', 'sn-1-1'],
    'an': [ 'අඞ්ගුත්තරනිකාය', '', 6, 0, 'sp', 'an-1-1'],
    'kn': [ 'ඛුද්දකනිකාය', '', 6, 0, 'sp', 'kn-1-1'],
    
    'dn-1': [ 'සීලක්ඛන්ධවග්ගො', 'සීලස්කන්ධවර්ගය', 4, 3, 'dn', 'dn-1-1'],
    'dn-2': [ 'මහාවග්ගො', '', 4, 0, 'dn', 'dn-2-1'],
    'dn-3': [ 'පාථීකවග්ගො', '', 4, 0, 'dn', 'dn-3-1'],
    'sn-1': [ 'සගාථවග්ග', '', 4, 0, 'sn', 'sn-1-1'],
    'sn-2': [ 'නිදානවග්ග', '', 4, 0, 'sn', 'sn-2-1'],
}

const dataInputFolder = __dirname + '/../public/data/'
const treeOutFilename = __dirname + '/../public/data/tree.json'
const searchIndexFilename = __dirname + '/../public/data/searchIndex.json'
const filesFilter = /^dn-1-|^sn-1-/ //

const getName = (text) => {
    text = text.trim().replace(/\{.*?\}/g, '') // remove footnotes
    return text.replace(/\.$/, '') // remove ending .
}

const inputFiles = fs.readdirSync(dataInputFolder).filter(name => filesFilter.test(name))
inputFiles.forEach(filename => {
    const obj = JSON.parse(fs.readFileSync(dataInputFolder + filename))
    const pali = obj[0], sinh = obj[1], fileKey = filename.split('.')[0]
    if (!pali.bookId || pali.language != 'pali' || !pali.entries.length) {
        console.error(`malformed pali section in ${filename}`)
        return;
    }
    const parentKey = fileKey.split('-').slice(0, -1).join('-');
    tree[parentKey][TFI.Level] = 4 // TODO - set sinh name too
    const parentStack = [[parentKey, 0]] // key and numChildren

    const headings = pali.entries.map((e, ind) => ({...e, ind})).filter(e => e.type == 'heading')
    if (headings[0].level != 3 || headings.some(he => he.level > 3 || !he.level)) {
        console.error(`malformed headings ${headings[0]} in ${filename}`);
        return;
    }
    
    headings.forEach(he => {
        while (tree[parentStack.slice(-1)[0][0]][TFI.Level] <= he.level) {
            parentStack.pop(); // until a parent with a higher level is found
        }
        const parent = parentStack.slice(-1)[0]
        parent[1]++ // increment numChildren
        const newKey = he.level == 3 ? fileKey : `${parent[0]}-${parent[1]}`

        const newNode = [ 
            getName(he.text),
            getName(sinh.entries[he.ind].text), // sinh name (can put in a seperate file too)
            parseInt(he.level),
            he.ind, // entry index
            parent[0], // parent key
            fileKey // filename without ext
        ]
        tree[newKey] = newNode
        parentStack.push([newKey, 0])
    })
    console.log(`processed ${filename} with ${headings.length} headings`)
});

fs.writeFileSync(treeOutFilename, vkb.json(JSON.stringify(tree)), {encoding: 'utf-8'})
console.log(`wrote tree to ${treeOutFilename} with ${Object.keys(tree).length} nodes`)

const searchIndex = {}
Object.keys(tree).forEach(key => {
    const paliW = tree[key][0].replace(/සුත්තං|\d+\.?/g, '').split(' ').filter(w => w.length)
    paliW.forEach(w => {
        if (!searchIndex[w]) searchIndex[w] = [w, []] // word and list of keys
        searchIndex[w][1].push(key)
    })
})
const indexAr = Object.values(searchIndex).sort((a, b) => b[1].length - a[1].length)
fs.writeFileSync(searchIndexFilename, vkb.json(JSON.stringify(indexAr)), {encoding: 'utf-8'})
console.log(`wrote searchIndex to ${treeOutFilename} with ${indexAr.length} words`)