/**
 * find new titles for headings in atta
 * run build-tree again after running this script
 */

const fs = require('fs');
const vkb = require('vkbeautify')
const path = require('path');
const { match } = require('assert');

const tree = JSON.parse(fs.readFileSync(__dirname + '/../../public/static/data/tree.json', { encoding: 'utf-8' }))
const filename = 'atta-sn-2'
const keysToProcess = Object.keys(tree).filter(k => tree[k][5] == filename)
//const dataInputFolder = __dirname + '/../public/static/text/'
const data = JSON.parse(fs.readFileSync(`${__dirname}/../../public/static/text/${filename}.json`, { encoding: 'utf-8' }))
//const filesList = ['sn-2', 'sn-3', 'sn-4']
console.log(`Processing ${keysToProcess.length} keys for file ${filename}`)

const diff = [], replaceMap = [], dryRun = true
keysToProcess.forEach(akey => {
    if (!akey.startsWith('atta-')) return
    
    const level = tree[akey][2], aName = tree[akey][0]
    const [pi, ei] = tree[akey][3], page = data.pages[pi], pEnt = page.pali.entries[ei]
    console.assert(pEnt.text.charAt(0) == aName.charAt(0), `name from file(${pEnt.text}) and tree(${aName}) not matching for key ${akey}`)
    
    if (level > 4) return
    const key = akey.substr(5) // remove atta part
    if (!tree[key]) {
        diff.push(`no mula,${key},${level},${aName}`)
        console.error(`no mula for ${key}, ${aName}`)
        return
    }
    const mName = /^[\d\-\. ]*(.*)$/.exec(tree[key][0]) // remove digits if any
    const match = /^([\d\-]+)\.\s*(.*)$/.exec(pEnt.text)
    let code = 'no digit'
    if (match) {
        if (!match[2].trim()) code = 'empty'
        else code = (mName[1].search(match[2].substr(0, 3)) >= 0) ? 'same' : 'not same'
    }
    if (code != 'empty' && code != 'same') diff.push(`${code},${key},${level},${aName},${mName[1]}`)
    
    
    if(!match) return
    const newName = match[1] + '. ' + mName[1] // todo vannana or suttadivannana for level 1
    replaceMap.push(`${key}\t\t${pEnt.text}\t->\t${newName}`)
    pEnt.text = newName
})

if (!dryRun) {
    fs.writeFileSync(path.join(__dirname, 'output', `${filename}.json`), vkb.json(JSON.stringify(data)), {encoding: 'utf-8'})
}
fs.writeFileSync(path.join(__dirname, 'diff', `${filename}-replace.txt`), replaceMap.join('\n'), {encoding: 'utf-8'})
fs.writeFileSync(path.join(__dirname, 'diff', `${filename}-diff.txt`), diff.join('\n'), {encoding: 'utf-8'})