// sinhala unicode -> easy singlish
const singlish_vowels = [
	['අ', 'a'],
	['ආ', 'aa'],
	['ඇ', 'ae'],
	['ඈ', 'ae, aee'],
	['ඉ', 'i'],
	['ඊ', 'ii'],
	['උ', 'u'],
	['ඌ', 'uu'],
	['එ', 'e'],
	['ඒ', 'ee'],
	['ඔ', 'o'],
	['ඕ', 'oo'],
	['ඓ', 'ai'], // sinhala only begin
	['ඖ', 'ou'],
	['ඍ', 'ru'],
	['ඎ', 'ru, ruu'],
	//['ඏ', 'li'], /** 2020-6-22 commented out some rare letters to prevent too many possibilites */
	//['ඐ', 'li, lii'] // sinhala only end
]

const singlish_specials = [
	['ඞ්', 'n'],
	['ං', 'n, m'],
	//['ඃ', 'n, m'] // sinhala only
]

const singlish_consonants = [
	['ක', 'k'],
	['ග', 'g'],
	['ච', 'c, ch'],
	['ජ', 'j'],
	['ඤ', 'n, kn'],
	['ට', 't'],
	['ඩ', 'd'],
	['ණ', 'n'],
	['ත', 'th'],
	['ද', 'd'],
	['න', 'n'],
	['ප', 'p'],
	['බ', 'b'],
	['ම', 'm'],
	['ය', 'y'],
	['ර', 'r'],
	['ල', 'l'],
	['ව', 'v, w'],
	['ශ', 'sh'],
	['ෂ', 'sh'],
	['ස', 's'],
	['හ', 'h'],
	['ළ', 'l'],
	['ෆ', 'f'],

	['ඛ', 'kh, k'],
	['ඨ', 't'],
	['ඝ', 'gh'],
	['ඟ', 'ng'],
	['ඡ', 'ch'],
	['ඣ', 'jh'],
	['ඦ', 'nj'],
	['ඪ', 'dh'],
	['ඬ', 'nd'],
	['ථ', 'th'],
	['ධ', 'dh'],
	['ඳ', 'nd'],
	['ඵ', 'ph'],
	['භ', 'bh'],
	['ඹ', 'mb'],
	['ඥ', 'gn'] // sinhala only
]

// sinh before, sinh after, roman after
const singlish_combinations = [
	['්', ''], //ක්
	['', 'a'], //ක
	['ා', 'a, aa'], //කා
	['ැ', 'ae'],
	['ෑ', 'ae, aee'],
	['ි', 'i'],
	['ී', 'i, ii'],
	['ු', 'u'],
	['ූ', 'u, uu'],
	['ෙ', 'e'],
	['ේ', 'e, ee'],
	['ෛ', 'ei'],
	['ො', 'o'],
	['ෝ', 'o, oo'],

	['්‍ර', 'ra'], //ක්‍ර
	['්‍රා', 'ra, raa'], //ක්‍රා
	['්‍රැ', 'rae'],
	['්‍රෑ', 'rae, raee'],
	['්‍රි', 'ri'],
	['්‍රී', 'ri, rii'],
	['්‍රෙ', 're'],
	['්‍රේ', 're, ree'],
	['්‍රෛ', 'rei'],
	['්‍රො', 'ro'],
	['්‍රෝ', 'ro, roo'],

	['්‍ය', 'ya'], //ක්‍ය
	['්‍යා', 'ya, yaa'], //ක්‍යා
	['්‍යැ', 'yae'],
	['්‍යෑ', 'yae, yaee'],
	['්‍යි', 'yi'],
	['්‍යී', 'yi, yii'],
	['්‍යු', 'yu'],
	['්‍යූ', 'yu, yuu'],
	['්‍යෙ', 'ye'],
	['්‍යේ', 'ye, yee'],
	['්‍යෛ', 'yei'],
	['්‍යො', 'yo'],
	['්‍යෝ', 'yo, yoo'],

	['ෘ', 'ru'],  // sinhala only begin
	['ෲ', 'ru, ruu'],
	['ෞ', 'au'],
	//['ෟ', 'li'],
	//['ෳ', 'li, lii'] // sinhala only end
]

const singlishMapping = {}
let maxSinglishKeyLen = 0
function addToSinglishMapping(values, pSinhStr, pRomanStr) {
	values.forEach(pair => {
		const sinh = pair[0] + pSinhStr

		const romans = pair[1].split(',');
		const pRomans = pRomanStr.split(',');
		romans.forEach(roman => {
			pRomans.forEach(pRoman => {
				const mapIndex = roman.trim() + pRoman.trim()
				if (mapIndex in singlishMapping) {
					singlishMapping[mapIndex].push(sinh)
				} else {
					singlishMapping[mapIndex] = [sinh]
					maxSinglishKeyLen = Math.max(mapIndex.length, maxSinglishKeyLen)
				}
			})
		})
	})
}

addToSinglishMapping(singlish_vowels, '', '')
addToSinglishMapping(singlish_specials, '', '')
singlish_combinations.forEach(combi => {
	addToSinglishMapping(singlish_consonants, combi[0], combi[1]);
})
console.log(`singlish map initialized. maxSinglishKeyLen: ${maxSinglishKeyLen}`)


export function getPossibleMatches(input) {
	let matches = []
	for (let len = 1; len <= maxSinglishKeyLen && len <= input.length; len++) {
		const prefix = input.slice(0, len)
		const rest = input.slice(len)
		matches.push(...(permuteMatches(prefix, rest)))
	}
	// remove 1) two consecutive hals 2) consecutive independent vowels 3) hal followed by a indept vowel
	// that do not occur in sinhala - reduce the number of matches to prevent sql query from exploding
	return matches.filter(match => !(/[ක-ෆ]්[ක-ෆ]්|[ක-ෆ]්[අ-ඎ]|[අ-ඎ][අ-ඎ]|.+[අ-ඎ]/.test(match)) )
}

function permuteMatches(prefix, rest) {
	// if prefix is all sinhala  then pass through the prefix - this allows sinhala and singlish mixing and ending dot
	const prefixMappings = isSinglishQuery(prefix) ? singlishMapping[prefix] : [prefix]
	if (!prefixMappings) { // recursion ending condition
		return []
	}
	if (!rest.length) {  // recursion ending condition
		return prefixMappings
	}
	const restMappings = getPossibleMatches(rest);
	const fullMappings = []
	restMappings.forEach(restM =>
		prefixMappings.forEach(prefixM =>
			fullMappings.push(prefixM + restM)
		)
	)
	return fullMappings
}

export function isSinglishQuery(query) {
	return /[A-Za-z]/.test(query);
}

export function dictWordList(input) {
	const query = input.toLowerCase().replace(/[\u200d\.,:\?\(\)“”‘’]/g, '') // remove common chars in the words
	// Search all singlish_combinations of translations from roman to sinhala
	let words = isSinglishQuery(query) ? getPossibleMatches(query) : []
	if (!words.length) words = [query]; // if not singlish or no possible matches found
	// TODO: improve this code to ignore na na la la sha sha variations at the comparison
	// for each word generate the stripEnd variation and add it
	const stripEnd = words.map(w => w.replace(/[\u0DCA-\u0DDF\u0D82\u0D83]+$/g, ''))
	// add possible vowels only if non singlish (only one word) - otherwise will be too many words
	const addVowel = !isSinglishQuery(query) ? ['ා', 'ි', 'ී', 'ු', 'ූ', 'ෙ', 'ො'].map(v => stripEnd[0] + v) : []
	return [...words, ...stripEnd, ...addVowel].filter((w, i, ar) => ar.indexOf(w) == i) // concat and remove duplicates
}