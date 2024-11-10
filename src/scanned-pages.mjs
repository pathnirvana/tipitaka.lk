/**
 * Created by Janaka on 2016-11-12.
 * copied from pitaka.lk/bjt on 2020-7-11
 */

export const bjtBooksInfo = {
    1: {
        name: 'පාරාජිකපාළි',
        maxPageId: 687,
        firstPageId: 25,
        pageNumOffset: 23,
        imagePrefix: 'VP01_Page_',
        parentKey: 'vp', // parent(s) of the first heading
        topSuffixes: 'prj', // key(s) of top level headings that doesn't follow numbering (ie. can not be determined automatically) 
        // (first heading should also be included)
    },
    2: {
        name: 'පාචිත්තිය පාළි 1',
        maxPageId: 590,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'VP02_Page_',
        parentKey: 'vp', topSuffixes: 'pct',
    },
    3: {
        name: 'පාචිත්තිය පාළි 2',
        maxPageId: 419,
        firstPageId: 31,
        pageNumOffset: 29,
        imagePrefix: 'VP03_Page_',
        parentKey: 'vp-pct', topSuffixes: '2',
    },
    4: {
        name: 'මහාවග්ගපාළි 1',
        maxPageId: 592,
        firstPageId: 77,
        pageNumOffset: 75,
        imagePrefix: 'VP04_Page_',
        parentKey: 'vp', topSuffixes: 'mv',
    },
    5: {
        name: 'මහාවග්ගපාළි 2',
        maxPageId: 449,
        firstPageId: 11,
        pageNumOffset: -509,
        imagePrefix: 'VP05_Page_',
        parentKey: 'vp-mv', topSuffixes: '6',
    },
    6: {
        name: 'චුල්ලවග්ගපාළි 1',
        maxPageId: 456,
        firstPageId: 17,
        pageNumOffset: 15,
        imagePrefix: 'VP06_Page_',
        parentKey: 'vp', topSuffixes: 'cv',
    },
    7: {
        name: 'චුල්ලවග්ගපාළි 2',
        maxPageId: 644,
        firstPageId: 23,
        pageNumOffset: 21,
        imagePrefix: 'VP07_Page_',
        parentKey: 'vp-cv', topSuffixes: '5',
    },
    8: {
        name: 'පරිවාරපාළි 1',
        maxPageId: 412,
        firstPageId: 21,
        pageNumOffset: 19,
        imagePrefix: 'VP08_Page_',
        parentKey: 'vp', topSuffixes: 'pv',
    },
    9: {
        name: 'පරිවාරපාළි 2',
        maxPageId: 351,
        firstPageId: 13,
        pageNumOffset: 11,
        imagePrefix: 'VP09_Page_',
        parentKey: 'vp-pv', topSuffixes: '5',
    },
    10: {
        name: 'දීඝනිකාය 1',
        maxPageId: 686,
        firstPageId: 15,
        pageNumOffset: 13,
        imagePrefix: 'DN1_Page_',
        parentKey: 'dn', topSuffixes: '1',
    },
    11: {
        name: 'දීඝනිකාය 2',
        maxPageId: 610,
        firstPageId: 15,
        pageNumOffset: 13,
        imagePrefix: 'DN2_Page_',
        parentKey: 'dn', topSuffixes: '2',
    },
    12: {
        name: 'දීඝනිකාය 3',
        maxPageId: 594,
        firstPageId: 15,
        pageNumOffset: 13,
        imagePrefix: 'DN3_Page_',
        parentKey: 'dn', topSuffixes: '3',
    },
    13: {
        name: 'මජ්ඣිමනිකාය 1',
        maxPageId: 833,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'MN1_Page_',
        parentKey: 'mn', topSuffixes: '1',
    },
    14: {
        name: 'මජ්ඣිමනිකාය 2',
        maxPageId: 795,
        firstPageId: 15,
        pageNumOffset: 13,
        imagePrefix: 'MN2_Page_',
        parentKey: 'mn', topSuffixes: '2',
    },
    15: {
        name: 'මජ්ඣිමනිකාය 3',
        maxPageId: 653,
        firstPageId: 15,
        pageNumOffset: 13,
        imagePrefix: 'MN3_Page_',
        parentKey: 'mn', topSuffixes: '3',
    },
    16: {
        name: 'සංයුත්තනිකාය 1',
        maxPageId: 529,
        firstPageId: 25,
        pageNumOffset: 23,
        imagePrefix: 'SN1_Page_',
        parentKey: 'sn', topSuffixes: '1',
    },
    17: {
        name: 'සංයුත්තනිකාය 2',
        maxPageId: 507,
        firstPageId: 21,
        pageNumOffset: 19,
        imagePrefix: 'SN2_Page_',
        parentKey: 'sn', topSuffixes: '2',
    },
    18: {
        name: 'සංයුත්තනිකාය 3',
        maxPageId: 606,
        firstPageId: 27,
        pageNumOffset: 25,
        imagePrefix: 'SN3_Page_',
        parentKey: 'sn', topSuffixes: '3',
    },
    19: {
        name: 'සංයුත්තනිකාය 4',
        maxPageId: 741,
        firstPageId: 25,
        pageNumOffset: 23,
        imagePrefix: 'SN4_Page_',
        parentKey: 'sn', topSuffixes: '4',
    },
    20: {
        name: 'සංයුත්තනිකාය 5-1',
        maxPageId: 483,
        firstPageId: 27,
        pageNumOffset: 25,
        imagePrefix: 'SN5_Page_',
        parentKey: 'sn', topSuffixes: '5',
    },
    21: {
        name: 'සංයුත්තනිකාය 5-2',
        maxPageId: 393,
        firstPageId: 23,
        pageNumOffset: 21,
        imagePrefix: 'SN6_Page_',
        parentKey: 'sn-5', topSuffixes: '7',
    },
    22: {
        name: 'අඞ්ගුත්තරනිකාය 1',
        maxPageId: 659,
        firstPageId: 37,
        pageNumOffset: 35,
        imagePrefix: 'AN1_Page_',
        parentKey: 'an', topSuffixes: '1',
    },
    23: {
        name: 'අඞ්ගුත්තරනිකාය 2',
        maxPageId: 573,
        firstPageId: 21,
        pageNumOffset: 19,
        imagePrefix: 'AN2_Page_',
        parentKey: 'an', topSuffixes: '4',
    },
    24: {
        name: 'අඞ්ගුත්තරනිකාය 3',
        maxPageId: 498,
        firstPageId: 21,
        pageNumOffset: 19,
        imagePrefix: 'AN3_Page_',
        parentKey: 'an', topSuffixes: '5',
    },
    25: {
        name: 'අඞ්ගුත්තරනිකාය 4',
        maxPageId: 535,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'AN4_Page_',
        parentKey: 'an', topSuffixes: '6',
    },
    26: {
        name: 'අඞ්ගුත්තරනිකාය 5',
        maxPageId: 607,
        firstPageId: 21,
        pageNumOffset: 19,
        imagePrefix: 'AN5_Page_',
        parentKey: 'an', topSuffixes: '8',
    },
    27: {
        name: 'අඞ්ගුත්තරනිකාය 6',
        maxPageId: 722,
        firstPageId: 27,
        pageNumOffset: 25,
        imagePrefix: 'AN6_Page_',
        parentKey: 'an', topSuffixes: '10',
    },
    28: {
        name: 'ඛුද්දකනිකාය 1',
        maxPageId: 618,
        firstPageId: 27,
        pageNumOffset: 25,
        imagePrefix: 'KN1_Page_',
        parentKey: 'kn', topSuffixes: 'khp,dhp,ud,iti',
    },
    29: {
        name: 'සූත්‍රනිපාතය',
        maxPageId: 414,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'KN2_Page_',
        parentKey: 'kn', topSuffixes: 'snp',
    },
    30: {
        name: 'විමනවත්ථු, පෙතවත්ථු',
        maxPageId: 450,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'KN3_Page_',
        parentKey: 'kn', topSuffixes: 'vv,pv',
    },
    31: {
        name: 'ථෙරගාථාපාළි',
        maxPageId: 486,
        firstPageId: 33,
        pageNumOffset: 31,
        imagePrefix: 'KN4_Page_',
        parentKey: 'kn', topSuffixes: 'thag,thig',
    },
    32: {
        name: 'ජාතකපාළි 1',
        maxPageId: 623,
        firstPageId: 29,
        pageNumOffset: 27,
        imagePrefix: 'KN5_Page_',
        parentKey: 'kn', topSuffixes: 'jat',
    },
    33: {
        name: 'ජාතකපාළි 2',
        maxPageId: 506,
        firstPageId: 13,
        pageNumOffset: 11,
        imagePrefix: 'KN6_Page_',
        parentKey: 'kn-jat', topSuffixes: '15',
    },
    34: {
        name: 'ජාතකපාළි 3',
        maxPageId: 573,
        firstPageId: 21,
        pageNumOffset: 19,
        imagePrefix: 'KN7_Page_',
        parentKey: 'kn-jat', topSuffixes: '22',
    },
    35: {
        name: 'මහානිද්දෙසපාළි',
        maxPageId: 761,
        firstPageId: 25,
        pageNumOffset: 23,
        imagePrefix: 'KN8_Page_',
        parentKey: 'kn', topSuffixes: 'mn',
    },
    36: {
        name: 'චුල්ලනිද්දෙසපාළි',
        maxPageId: 666,
        firstPageId: 17,
        pageNumOffset: 15,
        imagePrefix: 'KN9_Page_',
        parentKey: 'kn', topSuffixes: 'nc',
    },
    37: {
        name: 'පටිසම්භිදාමග්ගප්පකරණ 1',
        maxPageId: 550,
        firstPageId: 23,
        pageNumOffset: 21,
        imagePrefix: 'KN10_Page_',
        parentKey: 'kn', topSuffixes: 'ps',
    },
    38: {
        name: 'පටිසම්භිදාමග්ගප්පකරණ 2',
        maxPageId: 264,
        firstPageId: 13,
        pageNumOffset: 11,
        imagePrefix: 'KN11_Page_',
        parentKey: 'kn-ps', topSuffixes: '2',
    },
    39: {
        name: 'අපදානපාළි 1',
        maxPageId: 688,
        firstPageId: 29,
        pageNumOffset: 27,
        imagePrefix: 'KN12_Page_',
        parentKey: 'kn', topSuffixes: 'ap',
    },
    40: {
        name: 'අපදානපාළි 2-1',
        maxPageId: 459,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'KN13_Page_',
        parentKey: 'kn-ap-1', topSuffixes: '41',
    },
    41: {
        name: 'අපදානපාළි 2-2',
        maxPageId: 268,
        firstPageId: 13,
        pageNumOffset: 11,
        imagePrefix: 'KN14_Page_',
        parentKey: 'kn-ap', topSuffixes: '2',
    },
    42: {
        name: 'බුද්ධවංසපාළි, චරියාපිටකපාළි',
        maxPageId: 380,
        firstPageId: 27,
        pageNumOffset: 25,
        imagePrefix: 'KN15_Page_',
        parentKey: 'kn', topSuffixes: 'bv,cp',
    },
    43: {
        name: 'නෙත්තිප්පකරණ',
        maxPageId: 329,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'KN16_Page_',
        parentKey: 'kn', topSuffixes: 'nett',
    },
    44: {
        name: 'පෙටකොපදෙසො',
        maxPageId: 374,
        firstPageId: 23,
        pageNumOffset: 21,
        imagePrefix: 'KN17_Page_',
        parentKey: 'kn', topSuffixes: 'petk',
    },
    45: {
        name: 'ධම්මසඞ්ගණිප්පකරණ',
        maxPageId: 611,
        firstPageId: 37,
        pageNumOffset: 35,
        imagePrefix: 'AP01_Page_',
        parentKey: 'ap', topSuffixes: 'dhs',
    },
    46: {
        name: 'විභඞ්ගප්පකරණ 1',
        maxPageId: 427,
        firstPageId: 23,
        pageNumOffset: 21,
        imagePrefix: 'AP02_Page_',
        parentKey: 'ap', topSuffixes: 'vbh',
    },
    47: {
        name: 'විභඞ්ගප්පකරණ 2',
        maxPageId: 354,
        firstPageId: 17,
        pageNumOffset: 15,
        imagePrefix: 'AP03_Page_',
        parentKey: 'ap-vbh', topSuffixes: '10',
    },
    48: {
        name: 'කථාවත්‍ථුප්පකරණ 1',
        //sinh: 'කථාවස්තුප්‍රකරණය 1',
        maxPageId: 617,
        firstPageId: 31,
        pageNumOffset: 29,
        imagePrefix: 'AP04_Page_',
        parentKey: 'ap', topSuffixes: 'kvu',
    },
    49: {
        name: 'කථාවත්‍ථුප්පකරණ 2',
        //sinh: 'කථාවස්තුප්‍රකරණය 2',
        maxPageId: 585,
        firstPageId: 13,
        pageNumOffset: 11,
        imagePrefix: 'AP05_Page_',
        parentKey: 'ap-kvu', topSuffixes: '3',
    },
    50: {
        name: 'කථාවත්‍ථුප්පකරණ 3',
        //sinh: 'කථාවස්තුප්‍රකරණය 3',
        maxPageId: 545,
        firstPageId: 13,
        pageNumOffset: 11,
        imagePrefix: 'AP06_Page_',
        parentKey: 'ap-kvu', topSuffixes: '11',
    },
    51: {
        name: 'ධාතුකථාප්පකරණ, පුග්ගලපඤ්ඤත්තිප්පකරණ',
        //sinh: 'ධාතුකථා සහ පුද්ගල ප්‍රඥප්ති ප්‍රකරණය', // pali name was added (2024/10)
        maxPageId: 438,
        firstPageId: 17,
        pageNumOffset: 15,
        imagePrefix: 'AP07_Page_',
        parentKey: 'ap', topSuffixes: 'dhk,pug',
    },
    52: {
        name: 'යමකප්‍රකරණ 1',
        maxPageId: 577,
        firstPageId: 23,
        pageNumOffset: 21,
        imagePrefix: 'AP08_Page_',
        parentKey: 'ap', topSuffixes: 'yam',
    },
    53: {
        name: 'යමකප්‍රකරණ 2-1',
        maxPageId: 816,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'AP09_Page_',
        parentKey: 'ap-yam', topSuffixes: '6',
    },
    54: {
        name: 'යමකප්‍රකරණ 2-2',
        maxPageId: 550,
        firstPageId: 15,
        pageNumOffset: 13,
        imagePrefix: 'AP10_Page_',
        parentKey: 'ap-yam', topSuffixes: '10',
    },
    55: {
        name: 'පට්ඨානප්පකරණ 1',
        maxPageId: 591,
        firstPageId: 65,
        pageNumOffset: 63,
        imagePrefix: 'AP11_Page_',
        parentKey: 'ap', topSuffixes: 'pat',
    },
    56: {
        name: 'පට්ඨානප්පකරණ 2',
        maxPageId: 621,
        firstPageId: 14,
        pageNumOffset: 12,
        imagePrefix: 'AP12_Page_',
        parentKey: 'ap-pat,ap-pat-1', topSuffixes: '12',
    },
    57: {
        name: 'පට්ඨානප්පකරණ 3',
        maxPageId: 614,
        firstPageId: 17,
        pageNumOffset: 15,
        imagePrefix: 'AP13_Page_',
        parentKey: 'ap-pat,ap-pat-2', topSuffixes: '83',
    }
}

// initialize bjt params
let bjtBooksFolder, bjtImageExt
async function initBjtParams() {
    let bjtParams = ''
    if (typeof Android != 'undefined') {
        // put 10/DN1_Page_001.jpg/png in either Pictures/bjt_newbooks or bjt_books for local testing
        bjtParams = Android.getBjtParams()
    } else { // desktop app and website
        try {
            const response = await fetch('/tipitaka-query/bjt-params');
            if (response.ok) {
                bjtParams = await response.text();
            }
            // const response = await axios.get('/tipitaka-query/bjt-params')
            // bjtParams = response.data
        } catch (e) { }
    }
    if (!bjtParams) { // full path for online version from pitaka.lk
        bjtParams = 'https://pitaka.lk/bjt/newbooks|jpg'
    }
    [bjtBooksFolder, bjtImageExt] = bjtParams.split('|')
    console.log(`Loading bjt images from: ${bjtBooksFolder} ext: ${bjtImageExt}`)
}
initBjtParams()

export function getBJTImageSrc(bookId, pageNum) {
    const bookInfo = bjtBooksInfo[bookId]
    if (!bookInfo) return '';
    const paddedPage = ("00" + (bookInfo.pageNumOffset + Number(pageNum)).toString()).slice(-3)
    return bjtBooksFolder + '/' +
        (bookInfo.folder || bookId) + '/' +
        bookInfo.imagePrefix + paddedPage + '.' + bjtImageExt;
}