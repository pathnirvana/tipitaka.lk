/**
 * find new titles for headings in atta by copying from mula
 * 1) copy the aligned atta file to public/text folder
 * 2) run build-tree to generate keys for the new file
 * 3) run this script and check diff and replace files for errors
 * 4) copy the output json file to public/text folder
 * 5) run build-tree again to pickup new headings
 */

const fs = require('fs');
const vkb = require('vkbeautify')
const path = require('path');
const { match } = require('assert');

// following files were not processed - dn, mn-1 - headings were already good or copied manually
const filename = 'atta-mn-3'
const tree = JSON.parse(fs.readFileSync(__dirname + '/../../public/static/data/tree.json', { encoding: 'utf-8' }))
const keysToProcess = Object.keys(tree).filter(k => (tree[k][5] == filename && tree[k][2] <= 4))
const data = JSON.parse(fs.readFileSync(`${__dirname}/../../public/static/text/${filename}.json`, { encoding: 'utf-8' }))
console.log(`Processing ${keysToProcess.length} keys for file ${filename}`)


const diff = [], replaceMap = [], dryRun = false
keysToProcess.forEach(akey => {
    if (!akey.startsWith('atta-')) return
    
    const level = tree[akey][2], attaH = tree[akey][0]
    const [pi, ei] = tree[akey][3], page = data.pages[pi], pEnt = page.pali.entries[ei]
    console.assert(pEnt.text.charAt(0) == attaH.charAt(0),
        `name from file(${pEnt.text}) and tree(${attaH}) not matching for key ${akey}`)
    
    const key = akey.substr(5) // remove atta part
    if (!tree[key]) {
        console.error(`no mula for ${key}, ${attaH}`)
        return
    } else if (tree[key][2] != level && (level == 1 || tree[key][2] == 1)) {
        console.error(`level mismatch for ${key}, ${attaH}. ${level} and ${tree[key][2]}`)
    }
    const mulaRes = /^([\d\-\. ]*)(.*)$/.exec(tree[key][0]) // remove digits if any
    const attaRes = /^([\d\-\. ]*)(.*)$/.exec(pEnt.text)
    if (!attaRes) {
        console.error(`Malformed atta heading ${attaH}`)
        return
    }
    if (attaRes[2].trim() && mulaRes[2].search(attaRes[2].substr(0, 3)) == -1) {
        diff.push(`name mismatch,${key},${level},${attaH},${mulaRes[2]}`)
    } else if (level == 1 && !/සුත්(තං|තානි)$/.test(mulaRes[2])) { 
        diff.push(`not sutta,${key},${level},${attaH},${mulaRes[2]}`)
        return // do not replace
    }

    const attaDigit = attaRes[1], isRange = attaRes[1].indexOf('-') >= 0
    const newPaliH = attaDigit + getPaliName(isRange, mulaRes[2], level)
    if (pEnt.text != newPaliH)
        replaceMap.push(`${key}\t\tpali\t\t${pEnt.text}\t\t${newPaliH}`)
    pEnt.text = newPaliH

    // sinhala heading
    const sEnt = page.sinh.entries[ei]
    const msinhRes = /^([\d\-\. ]*)(.*)$/.exec(tree[key][1]) // remove digits if any
    if (level == 1 && !/සූත්‍රය?$/.test(msinhRes[2])) {
        console.error(`sinh side not ending with sutta ${key} ${msinhRes[2]}. can not replace`)
        return
    }
    const newSinhH = attaDigit + getSinhName(isRange, msinhRes[2], level)
    sEnt.text = newSinhH
    //console.log(newSinhH)
})

if (!dryRun) {
    fs.writeFileSync(path.join(__dirname, 'output', `${filename}.json`), vkb.json(JSON.stringify(data)), {encoding: 'utf-8'})
}
fs.writeFileSync(path.join(__dirname, 'diff', `${filename}-replace.txt`), replaceMap.join('\n'), {encoding: 'utf-8'})
fs.writeFileSync(path.join(__dirname, 'diff', `${filename}-diff.txt`), diff.join('\n'), {encoding: 'utf-8'})

function getPaliName(isRange, mulaName, level) { // vannana or suttadivannana for level 1
    if (level > 1) return mulaName
    let newHeading = mulaName + 'වණ්ණනා' // -සුත්තානිවණ්ණනා
    if (mulaName.endsWith('සුත්තං')) {
        const ending = isRange ? 'සුත්තාදිවණ්ණනා' : 'සුත්තවණ්ණනා'
        newHeading = mulaName.replace(/සුත්තං$/, ending)
    }
    return newHeading.replace(/ආදිසුත්තවණ්ණනා|ආදිසුත්තාදිවණ්ණනා/, 'සුත්තාදිවණ්ණනා')
}

function getSinhName(isRange, mulaName, level) {
    if (level > 1) return mulaName
    let newHeading = mulaName + ' වර්ණනා' // -සූත්‍ර වර්ණනා
    if (mulaName.endsWith('සූත්‍රය')) {
        const ending = isRange ? 'ආදි සූත්‍ර වර්ණනා' : 'සූත්‍ර වර්ණනාව'
        newHeading = mulaName.replace(/සූත්‍රය$/, ending)
    }
    return newHeading.replace(/ආදි ආදි/, 'ආදි')
}