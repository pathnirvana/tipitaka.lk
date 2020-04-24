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
    'vp': [ 'විනයපිටක', 'විනය පිටකය', 7, 0, 'root', ''],
    'sp': [ 'සුත්තපිටක', 'සූත්‍ර පිටකය', 7, 0, 'root', ''],
    'ap': [ 'අභිධම්මපිටක', 'අභිධර්ම පිටකය', 7, 0, 'root', ''],

    'dn': [ 'දීඝනිකාය', 'දික් සඟිය', 6, 0, 'sp', 'dn-1-1'],
    'mn': [ 'මජ්ඣිමනිකාය', 'මැදුම් සඟිය', 6, 0, 'sp', 'mn-1-1'],
    'sn': [ 'සංයුත්තනිකායො', 'සංයුත්ත නිකාය', 6, 0, 'sp', 'sn-1-1'],
    'an': [ 'අඞ්ගුත්තරනිකායො', 'අඞ්ගුත්තර සඟිය', 6, 0, 'sp', 'an-1-1'],
    'kn': [ 'ඛුද්දකනිකායො', 'කුදුගත් සඟිය', 6, 0, 'sp', 'kn-1-1'],
    
    'dn-1': [ 'සීලක්ඛන්ධවග්ගො', 'සීලස්කන්ධ වර්ගය', 5, 3, 'dn', 'dn-1-1'],
    'dn-2': [ 'මහාවග්ගො', 'මහා වර්ගය', 5, 0, 'dn', 'dn-2-1'],
    'dn-3': [ 'පාථීකවග්ගො', 'පාථීක වර්ගය', 5, 0, 'dn', 'dn-3-1'],
    'mn-1': [ 'මූලපණ්ණාසකො', 'මූලපණ්ණාසකය', 5, 0, 'mn', 'mn-1-1'],
    'mn-2': [ 'මජ්ඣිමපණ්ණාසකො', 'මජ්ඣිමපණ්ණාසකය', 5, 0, 'mn', 'mn-2-1'],
    'mn-3': [ 'උපරිපණ්ණාසකො', 'උපරිපණ්ණාසකය', 5, 0, 'mn', 'mn-3-1'],
    'sn-1': [ 'සගාථවග්ගො', 'සගාථ වර්ගය', 5, 0, 'sn', 'sn-1-1'],
    'sn-2': [ 'නිදානවග්ගො', 'නිදාන වර්ගය', 5, 0, 'sn', 'sn-2-1'],
    'sn-3': [ 'ඛන්ධකවග්ගො', 'ඛන්ධක වර්ගය', 5, 0, 'sn', 'sn-3-1'],
    'sn-4': [ 'සළායතනවග්ගො', 'සළායතන වර්ගය', 5, 0, 'sn', 'sn-4-1'],
    'sn-5': [ 'මහාවග්ගො', 'මහා වර්ගය', 5, 0, 'sn', 'sn-5-1'],
    'an-1': [ 'එකක නිපාතො', 'ඒකක නිපාතය', 5, 0, 'an', 'an-1-1'],
}

const dataInputFolder = __dirname + '/../public/text/'
const treeOutFilename = __dirname + '/../public/data/tree.json'
const searchIndexFilename = __dirname + '/../public/data/searchIndex.json'
const filesFilter = /^dn-|^mn-|^sn-/ //

const getName = (text) => {
    text = text.trim().replace(/\{.*?\}/g, '') // remove footnotes
    return text.replace(/\.$/, '') // remove ending .
}

let processedFilesCount = 0
const inputFiles = fs.readdirSync(dataInputFolder).filter(name => filesFilter.test(name))
inputFiles.forEach(filename => {
    const obj = JSON.parse(fs.readFileSync(dataInputFolder + filename))
    const pali = obj[0], sinh = obj[1], fileKey = filename.split('.')[0]
    if (!pali.bookId || pali.language != 'pali' || !pali.entries.length) {
        console.error(`malformed pali section in ${filename}`)
        return;
    }
    const parentKey = fileKey.split('-').slice(0, -1).join('-');
    tree[parentKey][TFI.Level] = 5
    const parentStack = [[parentKey, 0]] // key and numChildren

    const headings = pali.entries.map((e, ind) => ({...e, ind})).filter(e => e.type == 'heading')
    if (headings[0].level < 3 || headings[0].level > 4 || // should be 3 or 4
        headings.some(he => he.level > 4 || !he.level)) {
        console.error(`malformed headings ${JSON.stringify(headings[0])} in ${filename}`);
        return;
    }
    
    headings.forEach((he, hei) => {
        while (tree[parentStack.slice(-1)[0][0]][TFI.Level] <= he.level) {
            parentStack.pop(); // until a parent with a higher level is found
        }
        const parent = parentStack.slice(-1)[0]
        parent[1]++ // increment numChildren
        const newKey = hei > 0 ? `${parent[0]}-${parent[1]}` : fileKey

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
    processedFilesCount++
});

fs.writeFileSync(treeOutFilename, vkb.json(JSON.stringify(tree)), {encoding: 'utf-8'})
console.log(`wrote tree to ${treeOutFilename} with ${Object.keys(tree).length} nodes`)
console.log(`Processed ${processedFilesCount} out of ${inputFiles.length}`)

const ignoreRegex = new RegExp('සුත්තානි|සුත්තං|සූත්‍රය|\d+\.?', 'g')
const searchIndex = {}
Object.keys(tree).forEach(key => {
    [tree[key][0], tree[key][1]].forEach((name, lang) => { // process both pali and sinh names
        const words = name.replace(ignoreRegex, '').split(' ').filter(w => w.length)
        words.forEach(w => {
            if (!searchIndex[w]) searchIndex[w] = [w, []] // word and list of keys 
            if (searchIndex[w][1].indexOf(key) < 0) { // dedup before adding
                searchIndex[w][1].push(key) // (add lang too if needed later)
            }
        })
    }) 
})
const indexAr = Object.values(searchIndex).sort((a, b) => b[1].length - a[1].length)
fs.writeFileSync(searchIndexFilename, vkb.json(JSON.stringify(indexAr)), {encoding: 'utf-8'})
console.log(`wrote searchIndex to ${treeOutFilename} with ${indexAr.length} words`)