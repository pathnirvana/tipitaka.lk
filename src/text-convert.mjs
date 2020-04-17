/**
 * Code for convering to bandi akuru and processing footnotes
 * Modified from the text-convert in the proofreading app
 */
"use strict"

export const paliSpecials = [ //conjuncts with special ligratures
    ['ක', 'ව'],
    /*['ඤ', 'ච'],
    ['ඤ', 'ජ'],
    ['ඤ', 'ඡ'],
    ['ට', 'ඨ'],
    ['ණ', 'ඩ'],*/
    ['ත', 'ථ'],
    ['ත', 'ව'],
    ['න', 'ථ'],
    ['න', 'ද'],
    ['න', 'ධ'],
    /*['ද', 'ධ'],
    ['ද', 'ව']*/
];

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
export function convertPali(text) {
    text = text.replace(/\u200C/g, ''); // remove 200c char that appears in tipitaka.org text
    text = text.replace(/([ක-ෆ])\u0DCA([ක-ෆ])/g, '$1\u200D\u0DCA$2'); // adding a zwj between consos
    text = text.replace(/([ක-ෆ])\u0DCA([ක-ෆ])/g, '$1\u200D\u0DCA$2'); // do twice to handle consecutive hal ගන්ත්වා

    // remove hal
    text = text.replace(/\u0DDA/g, "\u0DD9"); //ee => e
    text = text.replace(/\u0DDD/g, "\u0DDC"); //oo => o

    // bandi -> conjunct for special pairs
    for (const key in paliSpecials) {
        var chars = paliSpecials[key];
        var re = new RegExp(chars[0] + "\u200D\u0DCA" + chars[1], "g");
        text = text.replace(re, chars[0] + "\u0DCA\u200D" + chars[1]);
    }
    return text;
}

function beautifySinh(text) {
    // adding the rakar & repaya
    // change joiners before U+0DBA Yayanna and U+0DBB Rayanna to Virama + ZWJ
    text = text.replace(/\u0DCA([\u0DBA\u0DBB])/g, '\u0DCA\u200D$1');
    return text
}

const footnoteRegEx = '\{(\\d+|\\S)([^\{\}]*?)\}';

export function textToHtml(text, language, bandiLetters) {
    text = text.replace(new RegExp(footnoteRegEx, 'g'), '<span class="fn-pointer">$1</span>');
    text = beautifySinh(text)
    if (language == 'pali' && bandiLetters) {
        text = convertPali(text)
    }
    text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // using the markdown styles
    text = text.replace(/__(.*?)__/g, '<u>$1</u>') // underline
    text = text.replace(/~~(.*?)~~/g, '<s>$1</s>') // strike through
    if (!text) text = '<s>Empty - තීරුව හිස් !</s>' // if left empty it is not clickable
    return text.split('\n').join('<br>')
}

export function extractFootnotes(text, language) {
    const regex = new RegExp(footnoteRegEx, 'g'), notes = [];
    let r;
    while ((r = regex.exec(text)) !== null) {
        const noteText = r[2].trim();
        if (noteText) {
            const noteHtml = textToHtml(noteText, language)
            notes.push(`<span class="fn-number">${r[1]}.</span><span class="fn-text">${noteHtml}</span>`); 
        }
    }
    return notes;
}