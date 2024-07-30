/**
 * Created by Janaka on 2016-11-12.
 * copied from pitaka.lk/bjt on 2020-7-11
 */

const bjtBooksInfo = {
    1: {
        name: 'පාරාජිකපාළි',
        maxPageId: 687,
        firstPageId: 25,
        pageNumOffset: 23,
        imagePrefix: 'VP01_Page_'
    },
    2: {
        name: 'පාචිත්තිය පාළි 1',
        maxPageId: 590,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'VP02_Page_'
    },
    3: {
        name: 'පාචිත්තිය පාළි 2',
        maxPageId: 419,
        firstPageId: 31,
        pageNumOffset: 29,
        imagePrefix: 'VP03_Page_'
    },
    4: {
        name: 'මහාවග්ගපාළි 1',
        maxPageId: 592,
        firstPageId: 77,
        pageNumOffset: 75,
        imagePrefix: 'VP04_Page_'
    },
    5: {
        name: 'මහාවග්ගපාළි 2',
        maxPageId: 449,
        firstPageId: 11,
        pageNumOffset: -509,
        imagePrefix: 'VP05_Page_'
    },
    6: {
        name: 'චුල්ලවග්ගපාළි 1',
        maxPageId: 456,
        firstPageId: 17,
        pageNumOffset: 15,
        imagePrefix: 'VP06_Page_'
    },
    7: {
        name: 'චුල්ලවග්ගපාළි 2',
        maxPageId: 644,
        firstPageId: 23,
        pageNumOffset: 21,
        imagePrefix: 'VP07_Page_'
    },
    8: {
        name: 'පරිවාරපාළි 1',
        maxPageId: 412,
        firstPageId: 21,
        pageNumOffset: 19,
        imagePrefix: 'VP08_Page_'
    },
    9: {
        name: 'පරිවාරපාළි 2',
        maxPageId: 351,
        firstPageId: 13,
        pageNumOffset: 11,
        imagePrefix: 'VP09_Page_'
    },
    10: {
        name: 'දීඝනිකාය 1',
        maxPageId: 686,
        firstPageId: 15,
        pageNumOffset: 13,
        imagePrefix: 'DN1_Page_'
    },
    11: {
        name: 'දීඝනිකාය 2',
        maxPageId: 610,
        firstPageId: 15,
        pageNumOffset: 13,
        imagePrefix: 'DN2_Page_'
    },
    12: {
        name: 'දීඝනිකාය 3',
        maxPageId: 594,
        firstPageId: 15,
        pageNumOffset: 13,
        imagePrefix: 'DN3_Page_'
    },
    13: {
        name: 'මජ්ඣිමනිකාය 1',
        maxPageId: 833,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'MN1_Page_'
    },
    14: {
        name: 'මජ්ඣිමනිකාය 2',
        maxPageId: 795,
        firstPageId: 15,
        pageNumOffset: 13,
        imagePrefix: 'MN2_Page_'
    },
    15: {
        name: 'මජ්ඣිමනිකාය 3',
        maxPageId: 653,
        firstPageId: 15,
        pageNumOffset: 13,
        imagePrefix: 'MN3_Page_'
    },
    16: {
        name: 'සංයුත්තනිකාය 1',
        maxPageId: 529,
        firstPageId: 25,
        pageNumOffset: 23,
        imagePrefix: 'SN1_Page_'
    },
    17: {
        name: 'සංයුත්තනිකාය 2',
        maxPageId: 507,
        firstPageId: 21,
        pageNumOffset: 19,
        imagePrefix: 'SN2_Page_'
    },
    18: {
        name: 'සංයුත්තනිකාය 3',
        maxPageId: 606,
        firstPageId: 27,
        pageNumOffset: 25,
        imagePrefix: 'SN3_Page_'
    },
    19: {
        name: 'සංයුත්තනිකාය 4',
        maxPageId: 741,
        firstPageId: 25,
        pageNumOffset: 23,
        imagePrefix: 'SN4_Page_'
    },
    20: {
        name: 'සංයුත්තනිකාය 5-1',
        maxPageId: 483,
        firstPageId: 27,
        pageNumOffset: 25,
        imagePrefix: 'SN5_Page_'
    },
    21: {
        name: 'සංයුත්තනිකාය 5-2',
        maxPageId: 393,
        firstPageId: 23,
        pageNumOffset: 21,
        imagePrefix: 'SN6_Page_'
    },
    22: {
        name: 'අඞ්ගුත්තරනිකාය 1',
        maxPageId: 659,
        firstPageId: 37,
        pageNumOffset: 35,
        imagePrefix: 'AN1_Page_'
    },
    23: {
        name: 'අඞ්ගුත්තරනිකාය 2',
        maxPageId: 573,
        firstPageId: 21,
        pageNumOffset: 19,
        imagePrefix: 'AN2_Page_'
    },
    24: {
        name: 'අඞ්ගුත්තරනිකාය 3',
        maxPageId: 498,
        firstPageId: 21,
        pageNumOffset: 19,
        imagePrefix: 'AN3_Page_'
    },
    25: {
        name: 'අඞ්ගුත්තරනිකාය 4',
        maxPageId: 535,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'AN4_Page_'
    },
    26: {
        name: 'අඞ්ගුත්තරනිකාය 5',
        maxPageId: 607,
        firstPageId: 21,
        pageNumOffset: 19,
        imagePrefix: 'AN5_Page_'
    },
    27: {
        name: 'අඞ්ගුත්තරනිකාය 6',
        maxPageId: 722,
        firstPageId: 27,
        pageNumOffset: 25,
        imagePrefix: 'AN6_Page_'
    },
    28: {
        name: 'ඛුද්දකනිකාය 1',
        maxPageId: 618,
        firstPageId: 27,
        pageNumOffset: 25,
        imagePrefix: 'KN1_Page_'
    },
    29: {
        name: 'සූත්‍රනිපාතය',
        maxPageId: 414,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'KN2_Page_'
    },
    30: {
        name: 'විමනවත්ථු, පෙතවත්ථු',
        maxPageId: 450,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'KN3_Page_'
    },
    31: {
        name: 'ථෙරගාථාපාළි',
        maxPageId: 486,
        firstPageId: 33,
        pageNumOffset: 31,
        imagePrefix: 'KN4_Page_'
    },
    32: {
        name: 'ජාතකපාළි 1',
        maxPageId: 623,
        firstPageId: 29,
        pageNumOffset: 27,
        imagePrefix: 'KN5_Page_'
    },
    33: {
        name: 'ජාතකපාළි 2',
        maxPageId: 506,
        firstPageId: 13,
        pageNumOffset: 11,
        imagePrefix: 'KN6_Page_'
    },
    34: {
        name: 'ජාතකපාළි 3',
        maxPageId: 573,
        firstPageId: 21,
        pageNumOffset: 19,
        imagePrefix: 'KN7_Page_'
    },
    35: {
        name: 'මහානිද්දෙසපාළි',
        maxPageId: 761,
        firstPageId: 25,
        pageNumOffset: 23,
        imagePrefix: 'KN8_Page_'
    },
    36: {
        name: 'චුල්ලනිද්දෙසපාළි',
        maxPageId: 666,
        firstPageId: 17,
        pageNumOffset: 15,
        imagePrefix: 'KN9_Page_'
    },
    37: {
        name: 'පටිසම්භිදාමග්ගප්පකරණ 1',
        maxPageId: 550,
        firstPageId: 23,
        pageNumOffset: 21,
        imagePrefix: 'KN10_Page_'
    },
    38: {
        name: 'පටිසම්භිදාමග්ගප්පකරණ 2',
        maxPageId: 264,
        firstPageId: 13,
        pageNumOffset: 11,
        imagePrefix: 'KN11_Page_'
    },
    39: {
        name: 'අපදානපාළි 1',
        maxPageId: 688,
        firstPageId: 29,
        pageNumOffset: 27,
        imagePrefix: 'KN12_Page_'
    },
    40: {
        name: 'අපදානපාළි 2-1',
        maxPageId: 459,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'KN13_Page_'
    },
    41: {
        name: 'අපදානපාළි 2-2',
        maxPageId: 268,
        firstPageId: 13,
        pageNumOffset: 11,
        imagePrefix: 'KN14_Page_'
    },
    42: {
        name: 'බුද්ධවංසපාළි, චරියාපිටකපාළි',
        maxPageId: 380,
        firstPageId: 27,
        pageNumOffset: 25,
        imagePrefix: 'KN15_Page_'
    },
    43: {
        name: 'නෙත්තිප්පකරණ',
        maxPageId: 329,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'KN16_Page_'
    },
    44: {
        name: 'පෙටකොපදෙසො',
        maxPageId: 374,
        firstPageId: 23,
        pageNumOffset: 21,
        imagePrefix: 'KN17_Page_'
    },
    45: {
        name: 'ධම්මසඞ්ගණිප්පකරණය',
        maxPageId: 611,
        firstPageId: 37,
        pageNumOffset: 35,
        imagePrefix: 'AP01_Page_'
    },
    46: {
        name: 'විභඞ්ගප්පකරණ 1',
        maxPageId: 427,
        firstPageId: 23,
        pageNumOffset: 21,
        imagePrefix: 'AP02_Page_'
    },
    47: {
        name: 'විභඞ්ගප්පකරණ 2',
        maxPageId: 354,
        firstPageId: 17,
        pageNumOffset: 15,
        imagePrefix: 'AP03_Page_'
    },
    48: {
        name: 'කථාවස්තුප්‍රකරණය 1',
        maxPageId: 617,
        firstPageId: 31,
        pageNumOffset: 29,
        imagePrefix: 'AP04_Page_'
    },
    49: {
        name: 'කථාවස්තුප්‍රකරණය 2',
        maxPageId: 585,
        firstPageId: 13,
        pageNumOffset: 11,
        imagePrefix: 'AP05_Page_'
    },
    50: {
        name: 'කථාවස්තුප්‍රකරණය 3',
        maxPageId: 545,
        firstPageId: 13,
        pageNumOffset: 11,
        imagePrefix: 'AP06_Page_'
    },
    51: {
        name: 'ධාතුකථා සහ පුද්ගල ප්‍රඥප්ති ප්‍රකරණය',
        maxPageId: 438,
        firstPageId: 17,
        pageNumOffset: 15,
        imagePrefix: 'AP07_Page_'
    },
    52: {
        name: 'යමකප්‍රකරණ 1',
        maxPageId: 577,
        firstPageId: 23,
        pageNumOffset: 21,
        imagePrefix: 'AP08_Page_'
    },
    53: {
        name: 'යමකප්‍රකරණ 2-1',
        maxPageId: 816,
        firstPageId: 19,
        pageNumOffset: 17,
        imagePrefix: 'AP09_Page_'
    },
    54: {
        name: 'යමකප්‍රකරණ 2-2',
        maxPageId: 550,
        firstPageId: 15,
        pageNumOffset: 13,
        imagePrefix: 'AP10_Page_'
    },
    55: {
        name: 'පට්ඨානප්පකරණ 1',
        maxPageId: 591,
        firstPageId: 65,
        pageNumOffset: 63,
        imagePrefix: 'AP11_Page_'
    },
    56: {
        name: 'පට්ඨානප්පකරණ 2',
        maxPageId: 621,
        firstPageId: 14,
        pageNumOffset: 12,
        imagePrefix: 'AP12_Page_'
    },
    57: {
        name: 'පට්ඨානප්පකරණ 3',
        maxPageId: 614,
        firstPageId: 17,
        pageNumOffset: 15,
        imagePrefix: 'AP13_Page_'
    }
}

import axios from 'axios'
import { IOS, platform } from './constants'
// initialize bjt params
let bjtBooksFolder, bjtImageExt
async function initBjtParams() {
    let bjtParams = ''
    if (typeof Android != 'undefined') {
        // put 10/DN1_Page_001.jpg/png in either Pictures/bjt_newbooks or bjt_books for local testing
        bjtParams = Android.getBjtParams()
    } else if (platform === IOS) {
        bjtParams = 'https://pitaka.lk/bjt/newbooks|jpg';
    } else { // desktop app and website
        try {
            const response = await axios.get('/tipitaka-query/bjt-params')
            bjtParams = response.data
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