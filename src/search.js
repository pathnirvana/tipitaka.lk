/**
 * Created by Janaka on 2020-4-12.
 */
"use strict"
import { isSinglishQuery, getPossibleMatches } from '@/singlish.js'
import axios from 'axios'

let searchIndex = []
const searchCache = []
const curSearchBooks = [] // for searching

const resultSettings = { // TODO move to settings
    minQueryLength: 2,
    maxSinglishLength: 10,
    maxResults: 100,  // search stopped after getting this many matches
    fullSearchBooksLength: 17,
}

export async function initSearch() {
    const response = await axios.get('/data/searchIndex.json')
    searchIndex = response.data
}

function updateFilterStatusDisplay() {
    if (curSearchBooks.length < resultSettings.fullSearchBooksLength) {
        $('#search-filter-status').html("සෙවුම පොත් " + curSearchBooks.length + " කට සීමා වී ඇත. වෙනස් කිරීමට <i class='fa fa-wrench fa-fw'></i> මත click කරන්න.");
    } else {
        $('#search-filter-status').text('');
    }
}

export const searchBarRules = [
    v => !!searchIndex.length || 'search index not loaded - wait',
    v => !!v || 'please enter sutta name',
    v => v.length >= 3 || 'අඩුම තරමේ අකුරු 3 ක් වත් ඇතුළු කරන්න.',
    v => (!isSinglishQuery(v) || v.length <= 10) || 'සිංග්ලිෂ් වලින් සෙවීමේ දී උපරිමය අකුරු 10 කට සීමා කර ඇත.',
    v => v.length <= 25 || 'උපරිම දිග අකුරු 25',
    v => !(/[^A-Za-z\u0D80-\u0DFF\u200D]/.test(v)) || 'සෙවුම් පදය සඳහා ඉංග්‍රීසි සහ සිංහල අකුරු පමණක් යොදන්න.',
]

export function getSearchSuggestions(input) {
    if (!input) return []
    const query = input.toLowerCase()
    for (let rule of searchBarRules) {
        const val = rule(query)
        if (val !== true) return [{ name: val, disabled: true }]
    }

    const results = searchDataSet(query)

    // extract text for each index and sort based on pali text
    // compute score for sorting
    return results.map(([i, keys]) => ({ 
        name: searchIndex[i][0], 
        score: computeScore(searchIndex[i][0].length, query.length, keys.length),
        keys, // key occurances in filter
        path: keys.length == 1 ? keys[0] : ('search/' + searchIndex[i][0]),
    })).sort((a, b) => b.score - a.score) // descending order
}

export function getSearchResults(input) {
    if (!input) return []
    const query = input.toLowerCase()
    const results = searchDataSet(query)
    return results.map(res => res[1]).flat()
}

const curFilterKeys = ['dn-1', 'sn']
// check if the entry belongs in the currently selected search books list
function inSearchFilter(key) {
    return !curFilterKeys.length || // if empty - no filter
        curFilterKeys.some(fKey => key.startsWith(fKey)) // key starts with one of the filter keys
}
function inFilterKeys(keys) {
    if (!curFilterKeys.length) return keys
    return keys.filter(key => curFilterKeys.some(fKey => key.startsWith(fKey)))
}

function searchDataSet(query) {
    //Check if we've searched for this term before
    let results = searchCache[query]
    if (results) {
        console.log(`query ${query} found in cache ${results.length} results`);
        return results;
    }
    
    // Search all singlish_combinations of translations from roman to sinhala
    let words = isSinglishQuery(query) ? getPossibleMatches(query) : [];
    if (!words.length) words = [query]; // if not singlish or no possible matches found
    // TODO: improve this code to ignore na na la la sha sha variations at the comparison
    results = []
    const queryReg = new RegExp(words.join('|'), "i");
    for (let i = 0; i < searchIndex.length && results.length < resultSettings.maxResults; i++) {
        if (queryReg.test(searchIndex[i][0])) {
            const filteredKeys = inFilterKeys(searchIndex[i][1])
            if (filteredKeys.length) results.push([i, filteredKeys]);
        }
    }
    console.log(`query ${query} full search ${results.length} results`);
    searchCache[query] = results
    return results
    
}

/* simple function to prefer shorter matches that occur more frequently */
function computeScore(matchLen, queryLen, numKeys) {
    // range 1 - 0.25 to 1 - 0.5
    return (1 - 0.05 * Math.min(Math.max(5, matchLen), 10)) * numKeys
}

function displaySearchResults() {
    var table = $('#search-results'), statusDiv = $('#search-status');
    table.hide().find('.result').remove();

    var entries = currentSearch.results;
    if (!entries.length) {
        statusDiv.text("“" + currentSearch.query + "” යන සෙවුම සඳහා ගැළපෙන වචන කිසිවක් හමුවුයේ නැත. වෙනත් සෙවුමක් උත්සාහ කර බලන්න.");
        return;
    }
    // add results
    $.each(entries, function (_1, entry) {
        var tr = $('<tr/>').attr('index', entry.index).addClass('result');
        tr.append(getBookNamePageNumberDisplay(entry));
        var namesTd = $('<td/>').addClass('result-sutta-name-parents').appendTo(tr);
        namesTd.append(
            $('<div/>').addClass('result-sutta-name').append(getSuttaNameDisplay(entry.index, 'result-sutta-name'), createStarIcon(entry.index)));
        namesTd.append(getParentsDisplay(entry));
        //tr.append(getPageNumberDisplay(entry));
        tr.appendTo(table);
    });
    table.slideDown('fast');
    if (entries.length < resultSettings.maxResults) {
        statusDiv.text("“" + currentSearch.query + "” යන සෙවුම සඳහා ගැළපෙන වචන " + entries.length + " ක් හමුවුනා.");
    } else {
        statusDiv.text("ඔබගේ සෙවුම සඳහා ගැළපෙන වචන " + entries.length + " කට වඩා හමුවුනා. එයින් මුල් වචන " + resultSettings.maxResults + " පහත දැක්වේ.");
    }
}

// sort entries by currentSort
function sortSearchResults() {
    currentSearch.results.sort(function (e1, e2) {
        if (e1[currentSort.by] < e2[currentSort.by])
            return -1 * currentSort.order;
        if (e1[currentSort.by] > e2[currentSort.by])
            return 1 * currentSort.order;
        if (currentSort.by == 'book') { // if book is the same sort by page
            if (e1.page < e2.page)
                return -1 * currentSort.order;
            if (e1.page > e2.page)
                return 1 * currentSort.order;
        }
        return 0;
    });
}

/**
 * Bookmarks related code
 */
const bookmarks = [];
function loadBookmarks() {
    bookmarks = JSON.parse(localStorage.getItem('bjt-bookmarks') || '[]');
}
function saveBookmarks() {
    localStorage.setItem('bjt-bookmarks', JSON.stringify(bookmarks));
}

/*$('body').on('click', 'i.star-icon', function(e) {
    var nodeId = $(this).parents('tr').attr('index');
    var isAdded = toggleBookmark(nodeId);
    $('tr[index='+nodeId+'] .star-icon').toggleClass('starred', isAdded); // all rendered star icons updated
});
loadBookmarks();*/

function toggleBookmark(nodeId) {
    nodeId = Number(nodeId);
    var index = bookmarks.indexOf(nodeId);
    if (index >= 0) {
        bookmarks.splice(index, 1);
    } else {
        bookmarks.push(nodeId);
    }
    saveBookmarks();
    return (index == -1); // true if the bookmark is added
}

function displayBookmarks() {
    var table = $('#bookmark-list'), statusDiv = $('#bookmark-status');
    table.hide().find('.result').remove();
    
    if (!bookmarks.length) {
        statusDiv.text("ඔබ එකදු සූත්‍රයක් වත් තරු යොදා නැත. පිටුසන් තැබීම සඳහා සූත්‍රය නම අසල ඇති තරු ලකුණ ඔබන්න.");
        return;
    }
    statusDiv.text("ඔබ විසින් තරුයෙදූ සූත්‍ර " + bookmarks.length + " ක් හමුවුනා.");

    // extract entries
    entries = _.map(bookmarks, function(ind) {
        return {
            index: ind,
            name: searchIndex[ind][SF.name],
            page: searchIndex[ind][SF.page],
            book: searchIndex[ind][SF.book],
            parents: getBJTParents(ind)
        };
    });

    $.each(entries, function (_1, entry) {
        var tr = $('<tr/>').attr('index', entry.index).addClass('result');
        tr.append(getBookNamePageNumberDisplay(entry));
        var namesTd = $('<td/>').addClass('result-sutta-name-parents').appendTo(tr);
        namesTd.append(
            $('<div/>').addClass('result-sutta-name').append(getSuttaNameDisplay(entry.index, 'result-sutta-name'), createStarIcon(entry.index)));
        namesTd.append(getParentsDisplay(entry));
        tr.appendTo(table);
    });

    table.slideDown('fast');
}

// when creating new star-icons
function createStarIcon(nodeId) {
    nodeId = Number(nodeId);
    return $('<i/>').addClass('fa fa-star star-icon').toggleClass('starred', bookmarks.indexOf(nodeId) >= 0);
}