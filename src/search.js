/**
 * Created by Janaka on 2020-4-12.
 */
"use strict"
import { isSinglishQuery, getPossibleMatches } from '@/singlish.js'

// search index fields
var SF = {
    book: 0,
    name: 1,
    parent: 2,
    page: 3,
    endPage: 4
};

var searchPrevQuery = "";
var searchCache = [];
var currentSearch = {}; // all results matching query
var currentSort = {by: 'name', order: 1}; // ascending by name
var curSearchBooks = []; // for searching

var resultSettings = {
    minQueryLength: 2,
    maxSinglishLength: 10,
    maxResults: 100,  // search stopped after getting this many matches
    fullSearchBooksLength: 17
};

function updateFilterStatusDisplay() {
    if (curSearchBooks.length < resultSettings.fullSearchBooksLength) {
        $('#search-filter-status').html("සෙවුම පොත් " + curSearchBooks.length + " කට සීමා වී ඇත. වෙනස් කිරීමට <i class='fa fa-wrench fa-fw'></i> මත click කරන්න.");
    } else {
        $('#search-filter-status').text('');
    }
}

export const searchBarRules = [
    v => !!v || 'please enter sutta name',
    v => v.length >= 3 || 'අඩුම තරමේ අකුරු 3 ක් වත් ඇතුළු කරන්න.',
    v => (!isSinglishQuery(v) || v.length <= 10) || 'සිංග්ලිෂ් වලින් සෙවීමේ දී උපරිමය අකුරු 10 කට සීමා කර ඇත.',
    v => v.length <= 25 || 'උපරිම දිග අකුරු 25',
    v => !(/[^A-Za-z\u0D80-\u0DFF\u200D]/.test(v)) || 'please enter only sinhala and english letters',
]

export function performSearch(input) {
    if (!input) return []
    const query = input.toLowerCase();
    for (let rule of searchBarRules) {
        const val = rule(query)
        if (val !== true) return [{ name: val }]
    }
    return []
          /*{ name: query, abbr: 'FL', id: 1 },
          { name: 'Georgia', abbr: 'GA', id: 2 },
          { name: 'Nebraska', abbr: 'NE', id: 3 },
          { name: 'California', abbr: 'CA', id: 4 },
          { name: 'New York', abbr: 'NY', id: 5 },
        ]*/
    
    if (query == searchPrevQuery) {
        return;
    }

    var table = $('#search-results'), statusDiv = $('#search-status');
    table.hide().find('.result').remove();
    searchPrevQuery = query;
    if (query.length < resultSettings.minQueryLength) {
        statusDiv.text("අඩුම තරමේ අකුරු " + resultSettings.minQueryLength + " ක් වත් ඇතුළු කරන්න.");
        return;
    }
    console.log(query);

    // query could be in roman script
    if (isSinglishQuery(query) && query.length > resultSettings.maxSinglishLength) {
        statusDiv.text("සිංග්ලිෂ් වලින් සෙවීමේ දී උපරිමය අකුරු " + resultSettings.maxSinglishLength + " කට සීමා කර ඇත.");
        return;
    }

    currentSearch = {query: query};
    searchDataSet();
    // sort and display
    sortSearchResults();
    displaySearchResults(); // display the results
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

// check if the entry belongs in the currently selected search books list
function inCurrentSearchBooks(ind) {
    return curSearchBooks.length == resultSettings.fullSearchBooksLength ||
        !_.isEmpty(_.intersection(getBJTParents(ind), curSearchBooks));
}

function searchDataSet() {
    var query = currentSearch.query;
    var results = [];

    //Check if we've searched for this term before
    if (query in searchCache) {
        results = searchCache[query];
        console.log("found in cache");
    } else {
        // Search all singlish_combinations of translations from roman to sinhala
        var words = isSinglishQuery(query) ? getPossibleMatches(query) : [];
        if (!words.length) words = [query]; // if not singlish or no possible matches found
        // TODO: improve this code to ignore na na la la sha sha variations at the comparison
        var queryReg = new RegExp(words.join('|'), "i");
        for (var i = 0; i < searchIndex.length && results.length < resultSettings.maxResults; i++) {
            if (searchIndex[i][SF.name].search(queryReg) != -1 && inCurrentSearchBooks(i)) {
                results.push(i);
            }
        }

        console.log("" + results.length + " hits");
        //Add results to cache
        searchCache[query] = results;
    }

    // extract text for each index and sort based on pali text
    // output an array of {index: xx, name: pali_name, parents: list of parents}
    results = _.uniq(results); // dedup indexes
    // extract entries
    results = _.map(results, function(ind) {
        return {
            index: ind,
            name: searchIndex[ind][SF.name],
            page: searchIndex[ind][SF.page],
            book: searchIndex[ind][SF.book],
            parents: getBJTParents(ind)
        };
    });
    currentSearch.results = results;
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

function refreshCurrentSearchDisplay(by, order) {
    currentSort = {by: by, order: order == 'asc' ? 1 : -1};
    sortSearchResults();
    displaySearchResults();
}

/**
 * Bookmarks related code
 */
var bookmarks = [];
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