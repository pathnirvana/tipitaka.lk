/**
 * find new titles for headings in atta
 */

const fs = require('fs');
const vkb = require('vkbeautify')
const path = require('path');
const { match } = require('assert');

const tree = JSON.parse(fs.readFileSync(__dirname + '/../public/static/data/tree.json', { encoding: 'utf-8' }))
const diff = []
Object.keys(tree).forEach(akey => {
    if (!akey.startsWith('atta-')) return
    key = akey.substr(5) // remove atta part

    if (!tree[key]) {
        diff.push(`0,${key},${tree[akey][2]},${tree[akey][0]}`)
        return
    }
    const match = /^[\d\.\- ]*(.*)$/.exec(tree[akey][0])
    let code = 1
    if (match) {
        if (!match[1].trim()) code = 4
        else code = (tree[key][0].search(match[1].substr(0, 3)) >= 0) ? 3 : 2
    }
    if (code < 3) diff.push(`${code},${key},${tree[akey][2]},${tree[akey][0]},${tree[key][0]}`)
})

fs.writeFileSync(path.join(__dirname, 'diff.txt'), diff.join('\n'), {encoding: 'utf-8'})