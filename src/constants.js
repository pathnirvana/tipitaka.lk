/** special flags and constants */
const settingsVersion = '1'
export const settingsKey = `tipitaka.lk-settings-${settingsVersion}`

export const allFilterKeys = ["vp-prj","vp-pct","vp-mv","dn-1","dn-2","dn-3","mn-1","mn-2","mn-3","sn-1","sn-2","sn-3","sn-4","sn-5",
"an-1","an-2","an-3","an-4","an-5","an-6","an-7","an-8","an-9","an-10","an-11","kn-khp","kn-dhp","kn-ud","kn-iti","kn-snp",
"kn-vv","kn-pv","kn-thag","kn-thig","kn-jat","kn-ps","kn-ap","kn-bv","kn-cp","kn-nett","kn-petk","ap-dhs","ap-vbh","ap-kvu",
"ap-dhk","ap-pug","ap-yam","ap-pat"]

export const allFilterLength = allFilterKeys.length

export const Language = Object.freeze({
    SI: 'si',
    EN: 'en',
})

export const dictionaryInfo = {
    'පොල්වත්තේ බුද්ධදත්ත': [Language.SI, 'BUS', 'si-buddhadatta', {d: 'පොල්වත්තේ බුද්ධදත්ත හිමි, පාලි-සිංහල අකාරාදිය', g: true}],
    'මඩිතියවෙල සුමඞ්ගල': [Language.SI, 'MS', 'si-sumangala', {d: 'මඩිතියවෙල සිරි සුමඞ්ගල හිමි, පාලි-සිංහල ශබ්දකෝෂය', g: true}],

    'Buddhadatta Concise': [Language.EN, 'BUE', 'en-buddhadatta', {d: 'Pali Dictionary by Polwatte Buddhadatta Mahathera', o: 'Projector', n: 20970, g: true}],
    'Nyanatiloka Buddhist': [Language.EN, 'ND', 'en-nyanatiloka', {d: 'Buddhist Dictionary by Ven Nyanatiloka', o: 'pced stardict', g: true}],
    'Pali Text Society': [Language.EN, 'PTS', 'en-pts', {d: 'Pali Text Society Dictionary', o: 'dpr', g: true}],
    'Proper Names': [Language.EN, 'PN', 'en-dppn', {d: 'Pali Proper Names by G P Malalasekera', o: 'dpr', g: true}],
    'VRI English': [Language.EN, 'VRI', 'en-vri', {d: 'Dictionary distributed with VRI Chatta Sangayana Software', g: true, n: 13508}],
    'Critical PD': [Language.EN, 'CR', 'en-critical', {d: 'Critical Pali Dictionary - limited number of words', o: 'extracted from https://cpd.uni-koeln.de/', n: 29669, g: true}],
}