/*Spilit the headwords string in to individual IDs in lookup table*/
DROP VIEW IF EXISTS view_lookup_split_values;
CREATE VIEW view_lookup_split_values AS
SELECT id, value
FROM (
    WITH RECURSIVE split_values AS (
        SELECT
            lookup_key AS id,
            substr(headwords, 1, instr(headwords || ',', ',') - 1) AS value,
            substr(headwords, instr(headwords || ',', ',') + 1) AS rest
        FROM lookup

        UNION ALL

        SELECT
            id,
            substr(rest, 1, instr(rest || ',', ',') - 1),
            substr(rest, instr(rest || ',', ',') + 1)
        FROM split_values
        WHERE rest <> ''
    )
    SELECT id, CAST(replace(replace(value, '[', ''), ']', '') AS INTEGER) AS value
    FROM split_values
    WHERE value <> ''
);


/*Create the dictionary, by concatinating the meanings of all headwords that were splited*/
DROP VIEW IF EXISTS view_dpd;
CREATE VIEW view_dpd AS 
SELECT a.word AS aword,  
group_concat(CASE WHEN c.C > 1 THEN '<b>' || lemma_1 || '</b>: ' ELSE '' END || Meaning, '<br>') || '<br><a href="https://www.dpdict.net/?q=' || a.word || '">Read more</a>' AS meaning FROM (

SELECT a.Id as word, lemma_1, 
CASE WHEN ifnull(pos, '') = '' THEN '' ELSE '<i>(' || pos || '.)</i> ' END ||
CASE 
WHEN ifnull(meaning_1, '') = '' AND ifnull(meaning_lit, '') = '' THEN '<i>(ref.)</i> ' || meaning_2
WHEN ifnull(meaning_1, '') <> '' AND ifnull(meaning_lit, '') <> '' THEN meaning_1 || ' <i>(lit.)</i> ' || meaning_lit
WHEN ifnull(meaning_1, '') <> '' THEN meaning_1 
WHEN ifnull(meaning_lit, '') <> '' THEN '<i>(lit.)</i> ' || meaning_lit ELSE '' END AS Meaning
FROM view_lookup_split_values a INNER join dpd_headwords h ON a.value = h.Id ORDER BY a.Id, lemma_1

) A LEFT JOIN (SELECT Id AS Word, Count(*) C FROM view_lookup_split_values GROUP BY Id) c ON a.Word = c.Word GROUP BY a.word;


/*Create new view to handle constructions in headword table, the deconstructor column in lookup table is not used*/
DROP VIEW IF EXISTS view_dpd_construction;
CREATE VIEW view_dpd_construction AS 
SELECT lemma_1 aword, construction meaning FROM dpd_headwords h INNER JOIN lookup l ON h.lemma_1 = l.lookup_key 
WHERE construction <> '' AND meaning_1 <> ''