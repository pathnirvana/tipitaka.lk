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
	['ඏ', 'li'],
	['ඐ', 'li, lii'] // sinhala only end
];

const singlish_specials = [
	['ඞ්', 'n'],
	['ං', 'n, m'],
	['ඃ', 'n, m'] // sinhala only
];

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
	['ඨ', 'th'],
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
];

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
	['ෟ', 'li'],
	['ෳ', 'li, lii'] // sinhala only end
];

const singlishMapping = [];
let maxSinglishKeyLen = 0;
function addToSinglishMapping(values, pSinhStr, pRomanStr) {
	values.forEach(pair => {
		const sinh = pair[0] + pSinhStr;

		const romans = pair[1].split(',');
		const pRomans = pRomanStr.split(',');
		romans.forEach(roman => {
			pRomans.forEach(pRoman => {
				const mapIndex = roman.trim() + pRoman.trim();
				if (mapIndex in singlishMapping) {
					singlishMapping[mapIndex].push(sinh);
				} else {
					singlishMapping[mapIndex] = [sinh];
					maxSinglishKeyLen = Math.max(mapIndex.length, maxSinglishKeyLen);
				}
			});
		});
	});
}

addToSinglishMapping(singlish_vowels, '', '')
addToSinglishMapping(singlish_specials, '', '')
singlish_combinations.forEach(combi => addToSinglishMapping(singlish_consonants, combi[0], combi[1]))

//console.log(singlishMapping)
//console.log('maxSinglishKeyLen: '+ maxSinglishKeyLen)

export function isSinglishQuery(query) {
	return /[a-z]/.test(query.toLowerCase())
}

export function getPossibleMatches(input) {
	let matches = [];
	for (let len = 1; len <= maxSinglishKeyLen && len <= input.length; len++) {
		const prefix = input.slice(0, len), rest = input.slice(len);
		matches = matches.concat(permuteMatches(prefix, rest));
	}
	return matches;
}

function permuteMatches(prefix, rest) {
	// if prefix is all sinhala  then pass through the prefix - this allows sinhala and singlish mixing and ending dot
	const prefixMappings = isSinglishQuery(prefix) ? singlishMapping[prefix] : [prefix];
	if (!prefixMappings) { // recursion ending condition
		return [];
	}
	if (!rest) {  // recursion ending condition
		return prefixMappings;
	}
	const restMappings = getPossibleMatches(rest);
	const fullMappings = [];
	restMappings.forEach(restM => {
		prefixMappings.forEach(prefixM => fullMappings.push(prefixM + restM))
	});
	return fullMappings;
}


