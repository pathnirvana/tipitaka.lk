/**
 * Read the data files and create the tree and the sutta name search index
 */

const fs = require('fs');
const vkb = require('vkbeautify')
const path = require('path')

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
    'vp': [ 'විනයපිටක', 'විනය පිටකය',       7, [0, 0], 'root', 'vp-prj'],
    'sp': [ 'සුත්තපිටක', 'සූත්‍ර පිටකය',        7, [0, 0], 'root', 'dn-1'],
    'ap': [ 'අභිධම්මපිටක', 'අභිධර්ම පිටකය',   7, [0, 0], 'root', 'ap-dhs'],

    'dn': [ 'දීඝනිකාය', 'දික් සඟිය',         6, [0, 0], 'sp', 'dn-1'],
    'mn': [ 'මජ්ඣිමනිකාය', 'මැදුම් සඟිය',     6, [0, 0], 'sp', 'mn-1-1'],
    'sn': [ 'සංයුත්තනිකායො', 'සංයුත්ත නිකාය', 6, [0, 0], 'sp', 'sn-1'],
    'an': [ 'අඞ්ගුත්තරනිකායො', 'අඞ්ගුත්තර සඟිය', 6, [0, 0], 'sp', 'an-1'],
    'kn': [ 'ඛුද්දකනිකායො', 'කුදුගත් සඟිය',      6, [0, 0], 'sp', 'kn-khp'],
    
    'mn-1': [ 'මූලපණ්ණාසකො', 'මූලපණ්ණාසකය',    5, [0, 0], 'mn', 'mn-1-1'], // TODO: following mn can be removed
    'mn-2': [ 'මජ්ඣිමපණ්ණාසකො', 'මජ්ඣිමපණ්ණාසකය', 5, [0, 0], 'mn', 'mn-2-1'],
    'mn-3': [ 'උපරිපණ්ණාසකො', 'උපරිපණ්ණාසකය',  5, [0, 0], 'mn', 'mn-3-1'],

    'kn-khp': [], // overwritten - but needed to maintain order
    'kn-dhp': [], // overwritten
    'kn-ud':  [], // overwritten
    'kn-iti': [], // overwritten
    'kn-snp': [], // 4 files 'සුත්තනිපාතො', 'සූත්‍ර නිපාතය',        5, [0, 0], 'kn', 'kn-snp-1'],
    'kn-vv': [], 'kn-pv': [],
    'kn-thag': [], //'ථෙරගාථාපාළි', 'ථෙරගාථා', 5, [0,0], 'kn', 'kn-thag-1'], // broken to two files
    'kn-thig': [], // single file
    'kn-jat': [], // 'ජාතකපාළි', 'ජාතකපාළි', 5, [0,0], 'kn', 'kn-jat-1'],
    'kn-mn': [], 'kn-nc': [], 
    'kn-ps': [], // 'පටිසම්භිදාමග්ගො', 'පටිසම්භිදාමාර්‍ගය', 5, [0,0], 'kn', 'kn-ps-1-1'],
    'kn-ap': [], //'අපදානපාළි', 'අපදානපාළිය', 5, [0,0], 'kn', 'kn-ap-1-1'],
    'kn-bv': [], 'kn-cp': [], // overwritten - needed for order
    'kn-nett': [], // needed for order
    'kn-petk': [], // needed for order - broken to two files
    
    'ap-dhs': [],
    'ap-vbh': [], // TODO - last chapter is not headingAtEnd (also see comment below for atta-ap-vbh)
    'ap-dhk': [], 'ap-pug': [], 'ap-kvu': [], 'ap-yam': [],
    'ap-pat': [], // ap-pat cant break due to page boundries, pat-2-83 is small but still needed since it is in a new book

    'vp-prj': [],
    'vp-pct': [],
    'vp-mv': [], 'vp-cv': [], 'vp-pv': [], // order

    /** atta tree */
    'atta-vp': [ 'විනය අට්ඨකථා', 'විනය අටුවාව',       7, [0, 0], 'root', 'atta-vp-prj'],
    'atta-sp': [ 'සුත්ත අට්ඨකථා', 'සූත්‍ර අටුවාව',        7, [0, 0], 'root', 'atta-dn-1'],
    'atta-ap': [ 'අභිධම්ම අට්ඨකථා', 'අභිධර්ම අටුවාව',   7, [0, 0], 'root', 'atta-ap-dhs'],

    'atta-dn': [ 'දීඝනිකාය අට්ඨකථා', 'දික් සඟිය අටුවාව',         6, [0, 0], 'atta-sp', 'atta-dn-1'],
    'atta-mn': [ 'මජ්ඣිමනිකාය අට්ඨකථා', 'මැදුම් සඟිය අටුවාව',     6, [0, 0], 'atta-sp', 'atta-mn-1'],
    'atta-sn': [ 'සංයුත්තනිකායො අට්ඨකථා', 'සංයුත්ත නිකාය අටුවාව', 6, [0, 0], 'atta-sp', 'atta-sn-1'],
    'atta-an': [ 'අඞ්ගුත්තරනිකායො අට්ඨකථා', 'අඞ්ගුත්තර නිකාය අටුවාව', 6, [0, 0], 'atta-sp', 'atta-an-1'],
    'atta-kn': [ 'ඛුද්දකනිකායො අට්ඨකථා', 'කුදුගත් සඟිය අටුවාව',      6, [0, 0], 'atta-sp', 'atta-kn-khp'],
    
    'atta-kn-khp': [], 'atta-kn-dhp': [], 'atta-kn-ud':  [], 'atta-kn-iti': [], 'atta-kn-snp': [], 'atta-kn-vv': [], 'atta-kn-pv': [], // order
    'atta-kn-thag': [], 'atta-kn-thig': [], 'atta-kn-jat': [], 'atta-kn-mn': [], 'atta-kn-nc': [], 'atta-kn-ps': [], 'atta-kn-ap': [], // order
    'atta-kn-bv': [], 'atta-kn-cp': [], 'atta-kn-nett': [], // order

    'atta-ap-dhs': [], // todo: atta link probably can be improved with more knowledge
    'atta-ap-vbh': [], // due to headingsAtEnd and multilevel in atta, attalink was very hacky. TODO- add headings at beginning to mula
    'atta-ap-dhk': [], 'atta-ap-pug': [], 'atta-ap-kvu': [], 'atta-ap-yam': [], 'atta-ap-pat': [],

    'atta-vp-prj': [], // TODO: atta mapping of few titles are wrong
    'atta-vp-pct': [], 'atta-vp-mv': [], 'atta-vp-cv': [], 'atta-vp-pv': [],

    // file must be named anya-vm-1 instead of just anya-vm and first heading changed to centered
    // otherwise will have an error since key 'anya' is not in the tree
    'anya-vm': [ 'විසුද්ධිමග්ගො', 'විසුද්ධි මාර්ගය',       7, [0, 0], 'root', 'anya-vm-1'], 
    
}
const headingAtEndKeys = ['kn-vv', 'kn-pv', 'kn-thag', 'kn-thig', 
        'kn-jat$', 'kn-jat-(5|11|22)', 'ap-dhs', 'ap-vbh', 'ap-yam-(6|7|8|10)', 'vp-pv(-2)?$'] 

const dataInputFolder = __dirname + '/../public/static/text/'
const treeOutFilename = __dirname + '/../public/static/data/tree.json'
const filesFilter = /^dn-|^mn-|^sn-|^an-|^kn-|^ap-|^vp-|^atta-|^anya-/

const getName = (text) => {
    text = text.trim()
    text = text.replace(/\{.*?\}/g, '') // remove footnotes
    text = text.replace(/[\[\]\(\)]/g, '') // remove [] ()
    text = text.replace(/\$\$|\*\*|__/g, '') // remove $$ or ** or __
    return text.replace(/\.$/, '').trim() // remove ending .
}
const getHeadings = (pages, lang) => 
    pages.map((p, pi) => p[lang].entries.map((e, ei) => ({...e, ei, pi}))
        .filter(e => e.type == 'heading')
    ).flat();
const incrementEInd = ([pi, ei], pages) => (ei + 1) < pages[pi].pali.entries.length ? [pi, ei+1] : [pi+1, 0]
const numEntryRegEx = /^[\d\. \-]+$/
const getPrevIfCenNum = ([pi, ei], pages) => {
    if (ei > 0) {
        const prevE = pages[pi].pali.entries[ei-1]
        if (prevE.type == 'centered' && numEntryRegEx.test(prevE.text)) return [pi, ei-1]
    }
    return [pi, ei]
}

let processedFilesCount = 0
const inputFiles = fs.readdirSync(dataInputFolder)
    .filter(name => filesFilter.test(name)).map(name => name.split('.')[0]).sort() // sort needed to get kn-nett before kn-nett-x
inputFiles.forEach(fileKey => {
    const obj = JSON.parse(fs.readFileSync(path.join(dataInputFolder, fileKey + '.json')))
    const paliOnly = /^ap-pat/.test(fileKey), isAtta = fileKey.startsWith('atta-')
    if (obj.filename != fileKey) {
        console.error(`filename mismatch ${obj.filename} in ${fileKey}`)
    }
    const pages = obj.pages
    if (!pages || !pages.length) {
        console.error(`malformed pages in ${fileKey}`)
        return;
    }
    const parentKey = fileKey.split('-').slice(0, -1).join('-'); // remove one from key
    const keyOffset = fileKey.split('-').slice(-1)[0] // last number/name
    const parentStack = [[parentKey, keyOffset]] // key and keyOffset(can be non numeric e.g. khp)

    const headings = getHeadings(pages, 'pali'), sinhHeadings = getHeadings(pages, 'sinh')
    if (!paliOnly && headings.length != sinhHeadings.length) {
        console.error(`pali and sinh headings mismatch in ${fileKey}. ${headings.length} and ${sinhHeadings.length}`)
        return
    }
    console.log(`processing ${fileKey} with ${headings.length} headings`)

    const errorHeadings = headings.filter(he => he.level > headings[0].level || !he.level)
    if (errorHeadings.length) {
        console.error(`some error headings ${JSON.stringify(errorHeadings)} in ${fileKey}`)
    }
    
    let prevEInd = [0,0] // init to 0 needed for ap-yam-10-3-4 (file starts with a headingAtEnd)
    const isHeadingAtEnd = headingAtEndKeys.some(k => fileKey.search(k) != -1) && !isAtta
    headings.forEach((he, hei) => {
        const [newKey, parentKey] = computeNewKey(he, parentStack, isAtta, he.text)
        const level = parseInt(he.level), eInd = [he.pi, he.ei] // page ind and entry index in the page

        tree[newKey] = [ 
            getName(he.text),
            getName(!paliOnly ? sinhHeadings[hei].text : ''), // sinh name (can put in a seperate file too)
            level,
            // if prev entry is a centered number include it too
            isHeadingAtEnd && level == 1 ? prevEInd : getPrevIfCenNum(eInd, pages), 
            parentKey,
            fileKey // filename without ext
        ]
        parentStack.push([newKey, 1])
        prevEInd = incrementEInd(eInd, pages) // when using prevEnd for headingAtEnd
    })
    processedFilesCount++
    //if(keyoffs.length) {console.log(keyoffs.join('|')); keyoffs = [];}
});

fs.writeFileSync(treeOutFilename, vkb.json(JSON.stringify(tree)), {encoding: 'utf-8'})
console.log(`wrote tree to ${treeOutFilename} with ${Object.keys(tree).length} nodes`)
console.log(`Processed ${processedFilesCount} out of ${inputFiles.length}`)

function computeNewKey(he, parentStack, isAtta, nameText) { // modifies parentStack
    while (tree[parentStack.slice(-1)[0][0]][TFI.Level] <= he.level) {
        parentStack.pop(); // until a parent with a higher level is found
    }
    const parent = parentStack.slice(-1)[0]
    
    if ('keyOffset' in he) parent[1] = he.keyOffset
    // else if (isAtta && (m = /^(\d+)/.exec(he.text))) {
    //     if (parent[1] != m[1]) { keyoffs.push(nameText);} //console.log(`${nameText} ${parent[0]}-${parent[1]}`);
    //     parent[1] = m[1] // if atta use the first number as keyoffset if any
    // }
        
    
    const newKey = `${parent[0]}-${parent[1]}`
    if (tree[newKey] && tree[newKey].length) console.error(`duplicate key ${newKey}. make sure keyOffset is increasing`)
    parent[1] = parseInt(parent[1]) + 1 // increment keyOffset for next sibling

    return [newKey, parent[0]]
}


// building the heading search index
// const searchIndexFilename = __dirname + '/../public/static/data/searchIndex.json'
// const ignoreWordList = fs.readFileSync(path.join(__dirname, 'heading-si-ignore-words.txt'), 'utf-8').split('\r\n')
// const searchIndex = {}
// Object.keys(tree).forEach(key => {
//     [tree[key][0], tree[key][1]].forEach((name, lang) => { // process both pali and sinh names
//         if (!name && !key.startsWith('ap-pat')) console.error(`empty heading in key ${key}`)

//         const words = name.replace(/[\(\)\u200d]/g, '') // additional removals for si
//             .split(' ')
//             .filter(w => w.length > 1 && ignoreWordList.indexOf(w) == -1)
//             .filter(w => !numEntryRegEx.test(w))
//         words.forEach(w => {
//             if (!searchIndex[w]) searchIndex[w] = [w, []] // word and list of keys 
//             if (searchIndex[w][1].indexOf(key) < 0) { // dedup before adding
//                 searchIndex[w][1].push(key) // (add lang too if needed later)
//             }
//         })
//     })
// })
// const indexAr = Object.values(searchIndex).sort((a, b) => b[1].length - a[1].length)
// //console.log(indexAr.slice(0, 20).map(ar => ar[0] + ' ' + ar[1].length).join('\n')) // log most frequent
// fs.writeFileSync(searchIndexFilename, vkb.json(JSON.stringify(indexAr)), {encoding: 'utf-8'})
// console.log(`wrote searchIndex to ${treeOutFilename} with ${indexAr.length} words`)