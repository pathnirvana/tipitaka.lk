/**
 * Read the data files and create the tree and the sutta name search index
 */

const fs = require('fs');
const vkb = require('vkbeautify')
const path = require('path');
const { match } = require('assert');

// the base tree - need to be built manually. can be read from a json file
const TFI = Object.freeze({
    Name: 0,
    Sinhala: 1,
    Level: 2,
    EntryInd: 3,
    Parent:  4,
    Filename: 5,
});
// order of the first few entries in this list is what determines the order in the tree
const tree = {
    'vp': [ 'විනයපිටක (අට්ඨකථා)', 'විනය පිටකය (අටුවාව)',       7, [0, 0], 'root', 'vp-prj'],
    'sp': [ 'සුත්තපිටක (අට්ඨකථා)', 'සූත්‍ර පිටකය (අටුවාව)',        7, [0, 0], 'root', 'dn-1-1'],
    'ap': [ 'අභිධම්මපිටක (අට්ඨකථා)', 'අභිධර්ම පිටකය (අටුවාව)',   7, [0, 0], 'root', 'ap-dhs'],

    'dn': [ 'දීඝනිකාය', 'දික් සඟිය',         6, [0, 0], 'sp', 'dn-1-1'],
    'mn': [ 'මජ්ඣිමනිකාය', 'මැදුම් සඟිය',     6, [0, 0], 'sp', 'mn-1-1'],
    'sn': [ 'සංයුත්තනිකායො', 'සංයුත්ත නිකාය', 6, [0, 0], 'sp', 'sn-1'],
    'an': [ 'අඞ්ගුත්තරනිකායො', 'අඞ්ගුත්තර සඟිය', 6, [0, 0], 'sp', 'an-1'],
    'kn': [ 'ඛුද්දකනිකායො', 'කුදුගත් සඟිය',      6, [0, 0], 'sp', 'kn-khp'],
    
    // 'dn-1': [ 'සීලක්ඛන්ධවග්ගො', 'සීලස්කන්ධ වර්ගය',   5, [0, 0], 'dn', 'dn-1-1'], // TODO: following dn/mn can be removed
    'dn-2': [ 'මහාවග්ගො', 'මහා වර්ගය',            5, [0, 0], 'dn', 'dn-2-1'], // keep until dn-2 is complete
    // 'dn-3': [ 'පාථීකවග්ගො', 'පාථීක වර්ගය',         5, [0, 0], 'dn', 'dn-3-1'],
    // 'mn-1': [ 'මූලපණ්ණාසකො', 'මූලපණ්ණාසකය',    5, [0, 0], 'mn', 'mn-1-1'],
    // 'mn-2': [ 'මජ්ඣිමපණ්ණාසකො', 'මජ්ඣිමපණ්ණාසකය', 5, [0, 0], 'mn', 'mn-2-1'],
    // 'mn-3': [ 'උපරිපණ්ණාසකො', 'උපරිපණ්ණාසකය',  5, [0, 0], 'mn', 'mn-3-1'],
    //'sn-1': [ 'සගාථවග්ගො', 'සගාථ වර්ගය',         5, [0, 0], 'sn', 'sn-1-1'],
    //'sn-2': [ 'නිදානවග්ගො', 'නිදාන වර්ගය',         5, [0, 0], 'sn', 'sn-2-1-1'],
    //'sn-2-1': [ '1. අභිසමයසංයුත්තං', '1. අභිසමය සංයුත්‌තය', 4, [0, 4], 'sn-2', 'sn-2-1-1'], // broken to 2
    //'sn-3': [ 'ඛන්ධකවග්ගො', 'ඛන්ධක වර්ගය',       5, [0, 0], 'sn', 'sn-3-1-1'],
    //'sn-3-1': [ '1. ඛන්ධසංයුත්තං', '1. ඛන්ධ සංයුත්තය', 4, [0, 4], 'sn-3', 'sn-3-1-1'], // broken to 3
    //'sn-4': [ 'සළායතනවග්ගො', 'සළායතන වර්ගය',    5, [0, 0], 'sn', 'sn-4-1-1'],
    //'sn-4-1': [ '1. සළායතනසංයුත්තං', '1. සළායතන සංයුත්තය', 4, [0, 3], 'sn-4', 'sn-4-1-1'], // broken to two files
    //'sn-5': [ 'මහාවග්ගො', 'මහා වර්ගය',           5, [0, 0], 'sn', 'sn-5-1'],
    //'an-1': [], // overwritten - not needed
    //'an-2': [], // not needed
    //'an-3': [], // 'තිකනිපාතො', 'තික නිපාතය',           5, [0, 0], 'an', 'an-3-1'],
    //'an-4': [ 'චතුක්කනිපාතො', 'චතුක්ක නිපාතය',       5, [0, 0], 'an', 'an-4-1'],
    //'an-5': [ 'පඤ්චකනිපාතො', 'පඤ්චක නිපාතය',       5, [0, 0], 'an', 'an-5-1'],
    //'an-6': [ 'ඡක්කනිපාතො', 'ඡක්ක නිපාතය',         5, [0, 0], 'an', 'an-6-1'],
    //'an-7': [ 'සත්තකනිපාතො', 'සත්තක නිපාතය',       5, [0, 0], 'an', 'an-7-1'],
    //'an-8': [ 'අට්ඨකනිපාතො', 'අට්ඨක නිපාතය',       5, [0, 0], 'an', 'an-8-1'],
    //'an-9': [], // not needed
    //'an-10': [ 'දසකනිපාතො', 'දසක නිපාතය',        5, [0, 0], 'an', 'an-10-1'],
    //'an-11': [], // not needed
}

const dataInputFolder = __dirname + '/../../bjt proof/dev/data/atta/auto-pages'
const treeOutFilename = __dirname + '/../public/static/data/tree-atta.json'
//const searchIndexFilename = __dirname + '/../public/static/data/searchIndex.json'
const filesFilter = /^dn-|^mn-|^sn-|^an-|^kn-|^ap-|^vp-/ //

const getName = (text) => {
    text = text.trim()
    text = text.replace(/\{.*?\}/g, '') // remove footnotes
    text = text.replace(/[\[\]]/g, '') // remove []
    text = text.replace(/\$\$/g, '') // remove $$
    return text.replace(/\.$/, '').trim() // remove ending .
}
const getHeadings = (pages, lang) => 
    pages.map((p, pi) => p[lang].entries.map((e, ei) => ({...e, ei, pi}))
        .filter(e => e.type == 'heading')
    ).flat();

let processedFilesCount = 0
const inputFiles = fs.readdirSync(dataInputFolder)
    .filter(name => filesFilter.test(name)).map(name => name.split('.')[0]).sort() // sort needed to get kn-nett before kn-nett-x
inputFiles.forEach(fileKey => {
    const obj = JSON.parse(fs.readFileSync(path.join(dataInputFolder, fileKey + '.json')))
    if (obj.filename != fileKey) {
        console.error(`filename mismatch ${obj.filename} in ${fileKey}`)
    }
    const pages = obj.pages
    if (!pages || !pages.length) {
        console.error(`malformed pages in ${fileKey}`)
        return;
    }
    const parentKey = fileKey.split('-').slice(0, -1).join('-'); // remove one from key
    const keyOffset = fileKey.split('-').slice(-1)[0] // last number
    const parentStack = [[parentKey, keyOffset]] // key and keyOffset(can be non numeric e.g. khp)

    const headings = getHeadings(pages, 'pali'), sinhHeadings = getHeadings(pages, 'sinh')
    if (headings.length != sinhHeadings.length) {
        console.error(`pali and sinh headings mismatch in ${fileKey}. ${headings.length} and ${sinhHeadings.length}`)
        return
    }
    console.log(`processing ${fileKey} with ${headings.length} headings`)

    const errorHeadings = headings.filter(he => he.level > headings[0].level || !he.level)
    if (errorHeadings.length) {
        console.error(`some error headings ${JSON.stringify(errorHeadings)} in ${fileKey}`)
    }
    
    headings.forEach((he, hei) => {
        const [newKey, parentKey] = computeNewKey(he, parentStack)
        tree[newKey] = [ 
            getName(he.text),
            getName(sinhHeadings[hei].text), // sinh name (can put in a seperate file too)
            parseInt(he.level),
            [he.pi, he.ei], // page ind and entry index in the page
            parentKey, // parent key
            fileKey // filename without ext
        ]
        parentStack.push([newKey, 1]) // can move to computeKey
    })
    processedFilesCount++
});

fs.writeFileSync(treeOutFilename, vkb.json(JSON.stringify(tree)), {encoding: 'utf-8'})
console.log(`wrote tree to ${treeOutFilename} with ${Object.keys(tree).length} nodes`)
console.log(`Processed ${processedFilesCount} out of ${inputFiles.length}`)

function computeNewKey(he, parentStack) { // modifies parentStack
    while (tree[parentStack.slice(-1)[0][0]][TFI.Level] <= he.level) {
        parentStack.pop(); // until a parent with a higher level is found
    }
    const parent = parentStack.slice(-1)[0]
    
    if ('keyOffset' in he) parent[1] = he.keyOffset
    else if (m = /^(\d+)/.exec(he.text)) parent[1] = m[1] // in the case of atta use the first number in the heading as keyoffset if any
    
    const newKey = `${parent[0]}-${parent[1]}`
    if (tree[newKey]) console.error(`duplicate key ${newKey} already in tree. make sure keyOffset is increasing`)
    parent[1] = parseInt(parent[1]) + 1 // increment keyOffset for next sibling

    return [newKey, parent[0]]
}

const mulaTree = JSON.parse(fs.readFileSync(__dirname + '/../public/static/data/tree.json', { encoding: 'utf-8' }))
const diff = Object.keys(tree).map(key => {
    if (!mulaTree[key]) {
        return `0,${key},${tree[key][2]},${tree[key][0]}`
    }
    const match = /^[\d\.\- ]*(.*)$/.exec(tree[key][0])
    let code = 1
    if (match) {
        if (!match[1].trim()) code = 4
        else code = (mulaTree[key][0].search(match[1].substr(0, 3)) >= 0) ? 3 : 2
    }
    if (code >= 3) return ''
    return `${code},${key},${tree[key][2]},${tree[key][0]},${mulaTree[key][0]}`
}).filter(line => !!line).join('\n')
fs.writeFileSync(path.join(__dirname, 'diff.txt'), diff, {encoding: 'utf-8'})