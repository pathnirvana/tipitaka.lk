-- Every SQL statement the tipitaka.lk app can run. The server only executes these (never client SQL);
-- the web app runs the same statements through the Android/iOS bridge with params inlined as literals.
-- Rules: SQLite 3.9.2 compatible (Android API 24) - no row values, window functions, IIF, UPSERT;
-- every output column must be non-NULL (use IFNULL) and integers must fit int32 (bridge limitations);
-- list params are a single string joined with char(31) and split with the recursive CTE shown below.
-- Header format: name, db (text|dict), params (name:str|int ...), max_rows.

-- name: meta.info
-- db: text
-- max_rows: 100
SELECT k, v FROM meta;

-- name: tree.node
-- db: text
-- params: key:str
-- max_rows: 1
SELECT n.id, n.key, IFNULL(n.parent_id, 0) AS parent_id, n.level, n.pali, n.sinh, IFNULL(f.name, '') AS file,
  n.page_idx, n.entry_idx, n.child_count, IFNULL(n.mirror_key, '') AS mirror_key,
  IFNULL(f.book_id, 0) AS book_id, IFNULL(f.page_offset, 0) AS page_offset, IFNULL(f.pali_only, 0) AS pali_only,
  IFNULL(f.page_count, 0) AS page_count, IFNULL(f.collection, '') AS collection
FROM node n LEFT JOIN file f ON f.id = n.file_id
WHERE n.key = :key;

-- name: tree.children
-- db: text
-- params: parent_id:int
-- max_rows: 2000
SELECT n.id, n.key, IFNULL(n.parent_id, 0) AS parent_id, n.level, n.pali, n.sinh, IFNULL(f.name, '') AS file,
  n.child_count
FROM node n LEFT JOIN file f ON f.id = n.file_id
WHERE (:parent_id = 0 AND n.parent_id IS NULL) OR n.parent_id = :parent_id
ORDER BY n.id;

-- name: tree.paths
-- db: text
-- params: ids:str
-- max_rows: 5000
WITH RECURSIVE w(x, rest) AS (
  SELECT NULL, :ids || char(31)
  UNION ALL SELECT substr(rest, 1, instr(rest, char(31)) - 1), substr(rest, instr(rest, char(31)) + 1)
  FROM w WHERE rest <> ''),
p(start, id, depth) AS (
  SELECT CAST(x AS INTEGER), CAST(x AS INTEGER), 0 FROM w WHERE x IS NOT NULL
  UNION ALL
  SELECT p.start, n.parent_id, p.depth + 1 FROM p JOIN node n ON n.id = p.id WHERE n.parent_id IS NOT NULL)
SELECT p.start, p.depth, n.id, n.key, n.level, n.pali, n.sinh, IFNULL(f.name, '') AS file
FROM p JOIN node n ON n.id = p.id LEFT JOIN file f ON f.id = n.file_id
ORDER BY p.start, p.depth;

-- name: tree.pathsByKeys
-- db: text
-- params: keys:str
-- max_rows: 5000
WITH RECURSIVE w(x, rest) AS (
  SELECT NULL, :keys || char(31)
  UNION ALL SELECT substr(rest, 1, instr(rest, char(31)) - 1), substr(rest, instr(rest, char(31)) + 1)
  FROM w WHERE rest <> ''),
p(start_key, id, depth) AS (
  SELECT w.x, n.id, 0 FROM w JOIN node n ON n.key = w.x WHERE w.x IS NOT NULL
  UNION ALL
  SELECT p.start_key, n.parent_id, p.depth + 1 FROM p JOIN node n ON n.id = p.id WHERE n.parent_id IS NOT NULL)
SELECT p.start_key, p.depth, n.id, n.key, n.level, n.pali, n.sinh, IFNULL(f.name, '') AS file
FROM p JOIN node n ON n.id = p.id LEFT JOIN file f ON f.id = n.file_id
ORDER BY p.start_key, p.depth;

-- name: tree.neighbor
-- db: text
-- params: id:int dir:int
-- max_rows: 1
SELECT n.id, n.key, IFNULL(f.name, '') AS file
FROM node n LEFT JOIN file f ON f.id = n.file_id
WHERE n.id = :id + :dir;

-- name: tree.titleIndex
-- db: text
-- max_rows: 30000
SELECT n.id, n.key, n.pali, n.sinh, IFNULL(n.grp, -1) AS grp, n.page_idx, n.entry_idx FROM node n ORDER BY n.id;

-- name: text.entries
-- db: text
-- params: file:str from:int to:int
-- max_rows: 6000
SELECT e.page_idx, e.entry_idx, IFNULL(n.key, '') AS node_key, IFNULL(n.mirror_key, '') AS mirror_key,
  e.p_type, IFNULL(e.p_level, -1) AS p_level, e.p_text,
  IFNULL(e.s_type, -1) AS s_type, IFNULL(e.s_level, -1) AS s_level, IFNULL(e.s_text, '') AS s_text,
  IFNULL(e.no_audio, 0) AS no_audio, IFNULL(e.audio_idx, -1) AS audio_idx, pg.page_num
FROM entry e JOIN file f ON f.id = e.file_id
JOIN page pg ON pg.file_id = e.file_id AND pg.page_idx = e.page_idx
LEFT JOIN node n ON n.id = e.node_id
WHERE f.name = :file AND e.page_idx BETWEEN :from AND :to
ORDER BY e.page_idx, e.entry_idx;

-- name: text.footnotes
-- db: text
-- params: file:str from:int to:int
-- max_rows: 3000
SELECT fn.page_idx, fn.lang, fn.idx, fn.text
FROM footnote fn JOIN file f ON f.id = fn.file_id
WHERE f.name = :file AND fn.page_idx BETWEEN :from AND :to
ORDER BY fn.page_idx, fn.lang, fn.idx;

-- name: fts.candidates
-- db: text
-- params: q:str lang:int groups:str limit:int
-- max_rows: 2000
WITH RECURSIVE w(x, rest) AS (
  SELECT NULL, :groups || char(31)
  UNION ALL SELECT substr(rest, 1, instr(rest, char(31)) - 1), substr(rest, instr(rest, char(31)) + 1)
  FROM w WHERE rest <> '')
SELECT fts.docid AS d, hex(matchinfo(fts, 'x')) AS mi, IFNULL(e.node_id, 0) AS node_id, f.name AS file,
  e.page_idx, e.entry_idx,
  CASE fts.docid % 2 WHEN 0 THEN length(e.p_text) ELSE length(IFNULL(e.s_text, '')) END AS len
FROM fts JOIN entry e ON e.id = fts.docid / 2 JOIN file f ON f.id = e.file_id
WHERE fts MATCH :q AND (:lang = 2 OR fts.docid % 2 = :lang)
  AND (:groups = '' OR f.grp IN (SELECT CAST(x AS INTEGER) FROM w WHERE x IS NOT NULL))
ORDER BY fts.docid LIMIT :limit;

-- name: fts.count
-- db: text
-- params: q:str lang:int groups:str
-- max_rows: 1
WITH RECURSIVE w(x, rest) AS (
  SELECT NULL, :groups || char(31)
  UNION ALL SELECT substr(rest, 1, instr(rest, char(31)) - 1), substr(rest, instr(rest, char(31)) + 1)
  FROM w WHERE rest <> '')
SELECT count(*) AS n
FROM fts JOIN entry e ON e.id = fts.docid / 2 JOIN file f ON f.id = e.file_id
WHERE fts MATCH :q AND (:lang = 2 OR fts.docid % 2 = :lang)
  AND (:groups = '' OR f.grp IN (SELECT CAST(x AS INTEGER) FROM w WHERE x IS NOT NULL));

-- name: fts.texts
-- db: text
-- params: ids:str
-- max_rows: 2000
WITH RECURSIVE w(x, rest) AS (
  SELECT NULL, :ids || char(31)
  UNION ALL SELECT substr(rest, 1, instr(rest, char(31)) - 1), substr(rest, instr(rest, char(31)) + 1)
  FROM w WHERE rest <> '')
SELECT e.id, e.p_type, IFNULL(e.p_level, -1) AS p_level, e.p_text, IFNULL(e.s_text, '') AS s_text,
  IFNULL(n.key, '') AS node_key, f.name AS file, e.page_idx, e.entry_idx
FROM w JOIN entry e ON e.id = CAST(w.x AS INTEGER) JOIN file f ON f.id = e.file_id LEFT JOIN node n ON n.id = e.node_id
WHERE w.x IS NOT NULL
ORDER BY e.id;

-- name: audio.entries
-- db: text
-- params: file:str
-- max_rows: 30000
SELECT e.audio_idx, e.page_idx, e.entry_idx
FROM entry e JOIN file f ON f.id = e.file_id
WHERE f.name = :file AND e.audio_idx IS NOT NULL
ORDER BY e.id;

-- name: dict.page
-- db: dict
-- params: words:str dicts:str prefix:int
-- max_rows: 50
WITH RECURSIVE w(x, rest) AS (
  SELECT NULL, :words || char(31)
  UNION ALL SELECT substr(rest, 1, instr(rest, char(31)) - 1), substr(rest, instr(rest, char(31)) + 1)
  FROM w WHERE rest <> ''),
d(x, rest) AS (
  SELECT NULL, :dicts || char(31)
  UNION ALL SELECT substr(rest, 1, instr(rest, char(31)) - 1), substr(rest, instr(rest, char(31)) + 1)
  FROM d WHERE rest <> '')
SELECT word, dict, meaning FROM dictionary
  WHERE word IN (SELECT x FROM w WHERE x IS NOT NULL)
    AND (dict IN (SELECT x FROM d WHERE x IS NOT NULL) OR dict = 'BR')
UNION
SELECT word, COUNT(dict) AS dict, 'like' AS meaning FROM dictionary
  WHERE :prefix = 1 AND rowid IN (
      SELECT dc.rowid FROM w JOIN dictionary dc ON dc.word > w.x AND dc.word < w.x || char(1114111)
      WHERE w.x IS NOT NULL AND w.x <> '')
    AND dict IN (SELECT x FROM d WHERE x IS NOT NULL)
  GROUP BY word
ORDER BY word LIMIT 50;

-- name: dict.inline
-- db: dict
-- params: words:str dicts:str
-- max_rows: 50
WITH RECURSIVE w(x, rest) AS (
  SELECT NULL, :words || char(31)
  UNION ALL SELECT substr(rest, 1, instr(rest, char(31)) - 1), substr(rest, instr(rest, char(31)) + 1)
  FROM w WHERE rest <> ''),
d(x, rest) AS (
  SELECT NULL, :dicts || char(31)
  UNION ALL SELECT substr(rest, 1, instr(rest, char(31)) - 1), substr(rest, instr(rest, char(31)) + 1)
  FROM d WHERE rest <> '')
SELECT word, dict, meaning FROM dictionary
WHERE word IN (SELECT x FROM w WHERE x IS NOT NULL) AND dict IN (SELECT x FROM d WHERE x IS NOT NULL)
ORDER BY word LIMIT 50;
