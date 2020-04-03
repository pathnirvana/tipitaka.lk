/**
 * Read the data files and create the tree and the sutta name search index
 */

const fs = require('fs');
const vkb = require('vkbeautify')

// the base tree - need to be built manually. can be read from a json file
const TFI = Object.freeze({
    Name:   0,
    Level: 1,
    Parent:  2,
});
const tree = {
    'vp': [ 'විනයපිටක', 10, 'root'],
    'sp': [ 'සුත්තපිටක', 7, 'root'],
    'ap': [ 'අභිධර්මපිටක', 10, 'root'],

    'dn': [ 'දීඝනිකාය', 6, 'sp'],
    'mn': [ 'මජ්ඣිමනිකාය', 6, 'sp'],
    'sn': [ 'සංයුත්තනිකාය', 6, 'sp'],
    'an': [ 'අඞ්ගුත්තරනිකාය', 6, 'sp'],
    'kn': [ 'ඛුද්දකනිකාය', 6, 'sp'],
    
    'dn-1': [ 'සීලක්ඛන්ධවග්ගො', 5, 'dn'],
    'dn-2': [ 'මහාවග්ගො', 5, 'dn'],
    'dn-3': [ 'පාථීකවග්ගො', 5, 'dn'],
    'sn-1': [ 'සගාථවග්ග', 5, 'sn'],
    'sn-2': [ 'නිදානවග්ග', 5, 'sn'],
}

const dataInputFolder = __dirname + '/data/'
const treeOutFilename = __dirname + '/../src/assets/data/tree.json'
const filesFilter = /^dn-1-|^sn-1-/ //
const getKeyAndInc = (stack) => {
    const pInfo = stack.slice(-1)[0] // get last parent
    return pInfo[0] + '-' + (++pInfo[1]) // append sutta num while incrementing num children
}
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
    tree[parentKey][TFI.Level] = 4
    const parentStack = [[parentKey, 0]] // key and numChildren

    const headings = pali.entries.filter(e => e.type == 'heading')
    if (headings[0].level != 3 || headings.some(he => he.level > 3 || !he.level)) {
        console.error(`malformed headings ${headings[0]} in ${filename}`);
        return;
    }
    
    headings.forEach(he => {
        while (tree[parentStack.slice(-1)[0][0]][TFI.Level] <= he.level) {
            parentStack.pop(); // until a parent with a higher level is found
        }
        
        const newNode = [ 
            getName(he.text),
            parseInt(he.level),
            // parent can be determined
        ]
        const newKey = he.level == 3 ? fileKey : getKeyAndInc(parentStack)

        tree[newKey] = newNode
        parentStack.push([newKey, 0])
    })
    console.log(`processed ${filename} with ${headings.length} headings`)
});

fs.writeFileSync(treeOutFilename, vkb.json(JSON.stringify(tree)), {encoding: 'utf-8'})
console.log(`wrote tree to ${treeOutFilename} with ${Object.keys(tree).length} nodes`)