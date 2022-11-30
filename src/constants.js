/** special flags and constants */
export const tipitakaAppVersion = 1.0 // used to determine if app needs to be updated 

const settingsVersion = '2'
export const settingsKey = `tipitaka.lk-settings-${settingsVersion}`
const bookmarksVersion = '1'
export const bookmarksStorageKey = `tipitaka.lk-bookmarks-${bookmarksVersion}`
const searchSettingsVersion = '1'
export const searchSettingsKey = `tipitaka.lk-search-settings-${searchSettingsVersion}`

export const filterTreeParents = ['vp','sp','ap','atta-sp','dn','mn','sn','an','kn']
export const allFilterKeys = ["vp-prj","vp-pct","vp-mv","vp-cv","vp-pv","dn-1","dn-2","dn-3","mn-1","mn-2","mn-3","sn-1","sn-2","sn-3","sn-4","sn-5",
"an-1","an-2","an-3","an-4","an-5","an-6","an-7","an-8","an-9","an-10","an-11","kn-khp","kn-dhp","kn-ud","kn-iti","kn-snp",
"kn-vv","kn-pv","kn-thag","kn-thig","kn-mn","kn-nc","kn-jat","kn-ps","kn-ap","kn-bv","kn-cp","kn-nett","kn-petk","ap-dhs","ap-vbh","ap-kvu",
"ap-dhk","ap-pug","ap-yam","ap-pat","atta-vp","atta-dn","atta-mn","atta-sn","atta-an","atta-kn","atta-ap","anya-vm"]

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

// helper function to copy the title to the og:title
export const copyMetaTitle = (title) => ({
    title,
    meta: [
        { property: 'og:title', content: title, vmid: 'og:title' },
    ]
})

// fetch api on chrome does not support file:// access (which is needed in android to access files from within webview)
// so instead of using axios/fetch use XHR
export function getJson(fileUrl) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest
        xhr.onload = function() {
            resolve(JSON.parse(xhr.responseText))
            //resolve(new Response(xhr.responseText, {status: xhr.status}))
        }
        xhr.onerror = function() {
            reject(new TypeError(`Request to file ${fileUrl} failed`))
        }
        if (typeof Android !== 'undefined') fileUrl = '/android_asset' + fileUrl
        xhr.open('GET', fileUrl)
        xhr.send(null)
    })
}


export async function callAndroidAsync(javaFuncName, params) {
	const rand = 'asyncJava_' + Math.floor(Math.random() * 1000000)
	window[rand] = {}
	
	// func called from android
	window[rand].callback = (isSuccess) => {
        const dataOrErr = Android.runAsyncResult(rand)
        //const unEscaped = dataOrErr.replace(/\u058D/g, "'") // use some symbol not used in the data
		if (isSuccess) window[rand].resolve(dataOrErr)
		else window[rand].reject(dataOrErr)
		delete window[rand] // clean up
	}
	
	// call some android function that returns immediately - should run in a new thread 
	// setTimeout(() => window[rand].callback(false, params.val * 2), 4000) // see testCallJavaAsync
	Android.runAsync(rand, javaFuncName, JSON.stringify(params))

	return new Promise((resolve, reject) => {
		window[rand].resolve = (data) => resolve(data)
		window[rand].reject = (err) => reject(err)
	})
}

// used for comparing entry locations
export function entryToKeyStr(entry) {
    const { key, eInd, language } = entry
    return `${key}:${eInd.join('-')}:${language}`
}
// same as above but without language
export function entryToAudioKey(entry) { 
    const { key, eInd } = entry
    return `${key}:${eInd.join('-')}`
}

// async function testCallJavaAsync() {
// 	const res = await callJavaAsync('testFunc', { val: 100 })
// 	console.log(`received res = ${res}`)
// }
// testCallJavaAsync()