package engine

import (
	"context"
	"database/sql"
	"strings"
)

// tipitaka.app's data in tipitaka.lk (build/cst.ts): mūla <-> aṭṭhakathā links of entries, places and people.
// Entity names are Roman (the web app shows them in Sinhala script).

// LinkTarget is an entry linked to another (its commentary, or the mūla it explains).
type LinkTarget struct {
	Key   string `json:"key"`  // the node of the entry
	File  string `json:"file"` // text file
	Page  int    `json:"page"`
	Entry int    `json:"entry"`
	Text  string `json:"text"` // the Pāḷi text (markup)
	Sinh  string `json:"sinh"` // the Sinhala translation
	Src   int    `json:"src"`  // 1 paragraph numbers, 2 commentary lemmas
}

const maxLinks = 80

// Links returns the entries linked to an entry: for a mūla entry its commentary, for an aṭṭhakathā entry the mūla.
func (e *Engine) Links(ctx context.Context, file string, page, entry int) ([]LinkTarget, error) {
	var id int
	err := e.text.QueryRowContext(ctx, `SELECT e.id FROM entry e JOIN file f ON f.id = e.file_id WHERE f.name = ? AND e.page_idx = ? AND e.entry_idx = ?`,
		file, page, entry).Scan(&id)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	} else if err != nil {
		return nil, err
	}
	other, this := "atta", "mula"
	if strings.HasPrefix(file, "atta-") {
		other, this = "mula", "atta"
	}
	rows, err := e.text.QueryContext(ctx, `SELECT IFNULL(n.key, ''), f.name, t.page_idx, t.entry_idx, t.p_text, IFNULL(t.s_text, ''), MIN(l.src)
		FROM entry_link l JOIN entry t ON t.id = l.`+other+` JOIN file f ON f.id = t.file_id LEFT JOIN node n ON n.id = t.node_id
		WHERE l.`+this+` = ? GROUP BY t.id ORDER BY t.id LIMIT ?`, id, maxLinks)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []LinkTarget{}
	for rows.Next() {
		var t LinkTarget
		if err := rows.Scan(&t.Key, &t.File, &t.Page, &t.Entry, &t.Text, &t.Sinh, &t.Src); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// LinkCounts gives the number of linked entries of each entry of the pages [from, to] of a file ("page:entry" -> n).
func (e *Engine) LinkCounts(ctx context.Context, file string, from, to int) (map[string]int, error) {
	this := "mula"
	if strings.HasPrefix(file, "atta-") {
		this = "atta"
	}
	rows, err := e.text.QueryContext(ctx, `SELECT e.page_idx, e.entry_idx, count(*) FROM entry e JOIN file f ON f.id = e.file_id
		JOIN entry_link l ON l.`+this+` = e.id WHERE f.name = ? AND e.page_idx BETWEEN ? AND ? GROUP BY e.id`, file, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var p, en, n int
		if err := rows.Scan(&p, &en, &n); err != nil {
			return nil, err
		}
		out[itoa(p)+":"+itoa(en)] = n
	}
	return out, rows.Err()
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

// Entity is a place, person, deity, group or animal.
type Entity struct {
	Slug     string  `json:"slug"`
	Type     string  `json:"type"`
	Name     string  `json:"name"`
	Lemma    string  `json:"lemma,omitempty"`
	Family   string  `json:"family,omitempty"`
	Meaning  string  `json:"meaning,omitempty"`
	Lat      float64 `json:"lat,omitempty"`
	Lon      float64 `json:"lon,omitempty"`
	Prec     int     `json:"prec,omitempty"` // 1 located, 2 probable, 3 approximate, 4 in / near
	Mentions int     `json:"mentions"`
	Settings int     `json:"settings"`
}

const entityCols = `e.slug, e.type, e.name, e.lemma, e.family, e.meaning, e.lat, e.lon, e.prec, e.mentions, e.settings`

func scanEntity(s interface{ Scan(...any) error }, en *Entity) error {
	return s.Scan(&en.Slug, &en.Type, &en.Name, &en.Lemma, &en.Family, &en.Meaning, &en.Lat, &en.Lon, &en.Prec, &en.Mentions, &en.Settings)
}

// SettingRole is an entity of a setting with its role (place, teacher, with, about).
type SettingRole struct {
	Entity
	Role   string `json:"role"`
	Source string `json:"source"` // nidana, inherit, atta ...
}

// SettingResult is the setting of a node (or of the node it was taken from: an ancestor, the first sutta of a book).
type SettingResult struct {
	Key   string        `json:"key"`  // the node the setting belongs to
	From  string        `json:"from"` // "" own, "parent", "first": the first sutta of the book / vagga
	Roles []SettingRole `json:"roles"`
}

// Settings returns the setting of a node: its own, else the nearest ancestor's, else its first sutta's.
func (e *Engine) Settings(ctx context.Context, key string) (*SettingResult, error) {
	var id int
	if err := e.text.QueryRowContext(ctx, `SELECT id FROM node WHERE key = ?`, key).Scan(&id); err == sql.ErrNoRows {
		return nil, ErrNotFound
	} else if err != nil {
		return nil, err
	}
	roles := func(node int) ([]SettingRole, error) {
		rows, err := e.text.QueryContext(ctx, `SELECT `+entityCols+`, s.role, s.source FROM node_setting s JOIN entity e ON e.id = s.entity_id
			WHERE s.node_id = ? ORDER BY s.listed DESC, CASE s.role WHEN 'place' THEN 0 WHEN 'teacher' THEN 1 WHEN 'with' THEN 2 ELSE 3 END, s.ord`, node)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []SettingRole{}
		for rows.Next() {
			var r SettingRole
			if err := rows.Scan(&r.Slug, &r.Type, &r.Name, &r.Lemma, &r.Family, &r.Meaning, &r.Lat, &r.Lon, &r.Prec, &r.Mentions, &r.Settings, &r.Role, &r.Source); err != nil {
				return nil, err
			}
			out = append(out, r)
		}
		return out, rows.Err()
	}
	res := &SettingResult{Key: key, Roles: []SettingRole{}}
	if r, err := roles(id); err != nil || len(r) > 0 {
		res.Roles = r
		return res, err
	}
	// the nearest ancestor with a setting
	cur := id
	for i := 0; i < 8; i++ {
		var parent int
		var pkey string
		if err := e.text.QueryRowContext(ctx, `SELECT IFNULL(p.id, 0), IFNULL(p.key, '') FROM node n LEFT JOIN node p ON p.id = n.parent_id WHERE n.id = ?`, cur).Scan(&parent, &pkey); err != nil || parent == 0 {
			break
		}
		r, err := roles(parent)
		if err != nil {
			return nil, err
		}
		if len(r) > 0 {
			res.Key, res.From, res.Roles = pkey, "parent", r
			return res, nil
		}
		cur = parent
	}
	// a book / vagga: the setting of its first node that has one (tree order: node ids)
	var first int
	var fkey string
	err := e.text.QueryRowContext(ctx, `SELECT n.id, n.key FROM node n WHERE n.id > ? AND n.key LIKE ? AND EXISTS (SELECT 1 FROM node_setting s WHERE s.node_id = n.id)
		ORDER BY n.id LIMIT 1`, id, key+"-%").Scan(&first, &fkey)
	if err == sql.ErrNoRows {
		return res, nil
	} else if err != nil {
		return nil, err
	}
	r, err := roles(first)
	res.Key, res.From, res.Roles = fkey, "first", r
	return res, err
}

// Names lists entities whose name starts with q (diacritics ignored), most mentioned first. All of them (the names
// page filters them itself, ~3300) with limit up to maxNames.
func (e *Engine) Names(ctx context.Context, q string, types []string, limit int) ([]Entity, error) {
	const maxNames = 10000
	if limit <= 0 {
		limit = 100
	} else if limit > maxNames {
		limit = maxNames
	}
	sqlq := `SELECT ` + entityCols + ` FROM entity e WHERE e.name_fold GLOB ?`
	args := []any{glob(Fold(strings.TrimSpace(q))) + "*"}
	if len(types) > 0 {
		sqlq += " AND e.type IN (" + placeholders(len(types)) + ")"
		for _, t := range types {
			args = append(args, t)
		}
	}
	sqlq += " ORDER BY e.mentions + 10 * e.settings DESC, e.name LIMIT ?"
	rows, err := e.text.QueryContext(ctx, sqlq, append(args, limit)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Entity{}
	for rows.Next() {
		var en Entity
		if err := scanEntity(rows, &en); err != nil {
			return nil, err
		}
		out = append(out, en)
	}
	return out, rows.Err()
}

// Places lists the entities with coordinates (the map).
func (e *Engine) Places(ctx context.Context) ([]Entity, error) {
	rows, err := e.text.QueryContext(ctx, `SELECT `+entityCols+` FROM entity e WHERE e.prec > 0 ORDER BY e.settings DESC, e.mentions DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Entity{}
	for rows.Next() {
		var en Entity
		if err := scanEntity(rows, &en); err != nil {
			return nil, err
		}
		out = append(out, en)
	}
	return out, rows.Err()
}

// NodeRef is a node with a count (settings of an entity, mentions in a sutta).
type NodeRef struct {
	Key   string `json:"key"`
	Pali  string `json:"pali"`
	Sinh  string `json:"sinh"`
	Role  string `json:"role,omitempty"`
	Count int    `json:"count,omitempty"`
	Page  int    `json:"page"`
	Entry int    `json:"entry"`
	// the parent's title (context for titles like "1. 1. 1")
	ParentPali string `json:"parentPali"`
	ParentSinh string `json:"parentSinh"`
	// the book and its group (nikāya, piṭaka part) of the node: the name page groups the suttas by book
	BookPali  string `json:"bookPali"`
	BookSinh  string `json:"bookSinh"`
	GroupPali string `json:"groupPali"`
	GroupSinh string `json:"groupSinh"`
	Atta      bool   `json:"atta"`
}

// bookKeys: the keys of the group (nikāya, piṭaka part) and the book of a node key: mn-2-4-1 -> mn, mn-2;
// atta-mn-2-4-1 -> atta-mn, atta-mn-2; kn-dhp-1 -> kn, kn-dhp
func bookKeys(key string) (group, book string) {
	parts := strings.Split(key, "-")
	n := 1
	if parts[0] == "atta" {
		n = 2
	}
	if len(parts) <= n {
		return key, key
	}
	return strings.Join(parts[:n], "-"), strings.Join(parts[:n+1], "-")
}

// addBooks fills the book and group titles of node refs (one query for all their keys).
func (e *Engine) addBooks(ctx context.Context, lists ...[]NodeRef) error {
	keys := map[string][2]string{}
	for _, l := range lists {
		for _, n := range l {
			g, b := bookKeys(n.Key)
			keys[g], keys[b] = [2]string{}, [2]string{}
		}
	}
	if len(keys) == 0 {
		return nil
	}
	args, marks := []any{}, []string{}
	for k := range keys {
		args, marks = append(args, k), append(marks, "?")
	}
	rows, err := e.text.QueryContext(ctx, `SELECT key, pali, sinh FROM node WHERE key IN (`+strings.Join(marks, ",")+`)`, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var k, pali, sinh string
		if err := rows.Scan(&k, &pali, &sinh); err != nil {
			return err
		}
		keys[k] = [2]string{pali, sinh}
	}
	for _, l := range lists {
		for i := range l {
			g, b := bookKeys(l[i].Key)
			l[i].GroupPali, l[i].GroupSinh, l[i].BookPali, l[i].BookSinh = keys[g][0], keys[g][1], keys[b][0], keys[b][1]
			l[i].Atta = strings.HasPrefix(l[i].Key, "atta-")
		}
	}
	return rows.Err()
}

// EntityPage is an entity with the suttas it is the setting of and the suttas that name it.
type EntityPage struct {
	Entity
	Settings   []NodeRef `json:"settingNodes"`
	Mentions   []NodeRef `json:"mentionNodes"`
	Related    []Related `json:"related"`    // names in the settings of the same suttas, with their role
	Homonyms   []Entity  `json:"homonyms"`   // other names of the same spelling
	Comentions []Related `json:"comentions"` // names often named in the same paragraphs (role "")
}

// Related is a name named with another one, how often (the same suttas' settings, the same paragraphs).
type Related struct {
	Entity
	Role  string `json:"role,omitempty"`
	Count int    `json:"count"`
}

// related runs a query of entityCols, role, count.
func (e *Engine) related(ctx context.Context, q string, args ...any) ([]Related, error) {
	rows, err := e.text.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Related{}
	for rows.Next() {
		var r Related
		en := &r.Entity
		if err := rows.Scan(&en.Slug, &en.Type, &en.Name, &en.Lemma, &en.Family, &en.Meaning, &en.Lat, &en.Lon, &en.Prec, &en.Mentions, &en.Settings, &r.Role, &r.Count); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// EntityInfo returns an entity's page.
func (e *Engine) EntityInfo(ctx context.Context, slug string) (*EntityPage, error) {
	p := &EntityPage{Settings: []NodeRef{}, Mentions: []NodeRef{}}
	var id int
	en := &p.Entity // (the page's Settings / Mentions lists shadow the entity's counts)
	err := e.text.QueryRowContext(ctx, `SELECT e.id, `+entityCols+` FROM entity e WHERE e.slug = ?`, slug).Scan(&id, &en.Slug, &en.Type, &en.Name,
		&en.Lemma, &en.Family, &en.Meaning, &en.Lat, &en.Lon, &en.Prec, &en.Mentions, &en.Settings)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	} else if err != nil {
		return nil, err
	}
	if p.Related, err = e.related(ctx, `SELECT `+entityCols+`, s2.role, count(*) AS c FROM node_setting s1
		JOIN node_setting s2 ON s2.node_id = s1.node_id AND s2.entity_id != s1.entity_id JOIN entity e ON e.id = s2.entity_id
		WHERE s1.entity_id = ? GROUP BY s2.entity_id, s2.role ORDER BY c DESC, e.name_fold LIMIT 60`, id); err != nil {
		return nil, err
	}
	if p.Comentions, err = e.related(ctx, `SELECT `+entityCols+`, '', c.n FROM comention c JOIN entity e ON e.id = c.other_id
		WHERE c.entity_id = ? ORDER BY c.n DESC LIMIT 40`, id); err != nil {
		return nil, err
	}
	homonyms, err := e.text.QueryContext(ctx, `SELECT `+entityCols+` FROM entity e WHERE e.name = ? AND e.id != ? ORDER BY e.settings DESC, e.mentions DESC, e.lemma`, p.Name, id)
	if err != nil {
		return nil, err
	}
	p.Homonyms = []Entity{}
	for homonyms.Next() {
		var h Entity
		if err := scanEntity(homonyms, &h); err != nil {
			homonyms.Close()
			return nil, err
		}
		p.Homonyms = append(p.Homonyms, h)
	}
	homonyms.Close()
	nodes := func(q string, args ...any) ([]NodeRef, error) {
		rows, err := e.text.QueryContext(ctx, q, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []NodeRef{}
		for rows.Next() {
			var n NodeRef
			if err := rows.Scan(&n.Key, &n.Pali, &n.Sinh, &n.Role, &n.Count, &n.Page, &n.Entry, &n.ParentPali, &n.ParentSinh); err != nil {
				return nil, err
			}
			out = append(out, n)
		}
		return out, rows.Err()
	}
	if p.Settings, err = nodes(`SELECT n.key, n.pali, n.sinh, s.role, 0, n.page_idx, n.entry_idx, IFNULL(p.pali, ''), IFNULL(p.sinh, '')
		FROM node_setting s JOIN node n ON n.id = s.node_id LEFT JOIN node p ON p.id = n.parent_id
		JOIN entity e ON e.id = s.entity_id WHERE e.slug = ? ORDER BY n.id LIMIT 300`, slug); err != nil {
		return nil, err
	}
	// the suttas (nodes of the entries) that name it, the first entry of each
	p.Mentions, err = nodes(`SELECT n.key, n.pali, n.sinh, '', count(*), MIN(t.page_idx * 10000 + t.entry_idx) / 10000, MIN(t.page_idx * 10000 + t.entry_idx) % 10000,
		IFNULL(p.pali, ''), IFNULL(p.sinh, '')
		FROM entry_mention m JOIN entity e ON e.id = m.entity_id JOIN entry t ON t.id = m.entry_id JOIN node n ON n.id = t.node_id
		LEFT JOIN node p ON p.id = n.parent_id WHERE e.slug = ? GROUP BY n.id ORDER BY n.id LIMIT 500`, slug)
	if err != nil {
		return nil, err
	}
	return p, e.addBooks(ctx, p.Settings, p.Mentions)
}

// ParaNames lists the entities named in an entry.
func (e *Engine) ParaNames(ctx context.Context, file string, page, entry int) ([]Entity, error) {
	rows, err := e.text.QueryContext(ctx, `SELECT `+entityCols+` FROM entry_mention m JOIN entity e ON e.id = m.entity_id
		JOIN entry t ON t.id = m.entry_id JOIN file f ON f.id = t.file_id WHERE f.name = ? AND t.page_idx = ? AND t.entry_idx = ?
		ORDER BY e.type, e.mentions DESC`, file, page, entry)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Entity{}
	for rows.Next() {
		var en Entity
		if err := scanEntity(rows, &en); err != nil {
			return nil, err
		}
		out = append(out, en)
	}
	return out, rows.Err()
}

// Gloss is a commentary lemma and the mūla words it quotes (tipitaka.app's word alignment, build/cst.ts), seen from a
// file: side "t" when the file has the quoted words, "c" when it has the lemma. Words are shared/tokenize numbers;
// spans are inclusive, the end of the explanation (in the aṭṭhakathā file) is exclusive.
type Gloss struct {
	G    int     `json:"g"`
	Side string  `json:"side"`
	P    int     `json:"p"`
	E    int     `json:"e"`
	W    int     `json:"w"`
	EP   int     `json:"ep"`
	EE   int     `json:"ee"`
	EW   int     `json:"ew"`
	File string  `json:"file"` // the other side
	Key  string  `json:"key"`
	TP   int     `json:"tp"`
	TE   int     `json:"te"`
	TW   int     `json:"tw"`
	TEP  int     `json:"tep"`
	TEE  int     `json:"tee"`
	TEW  int     `json:"tew"`
	XP   int     `json:"xp"`
	XE   int     `json:"xe"`
	XW   int     `json:"xw"`
	Conf float64 `json:"conf"`
	Src  string  `json:"src"`
}

const maxGlosses = 3000

// Glosses returns the glosses touching the entries of the pages [from, to] of a file.
func (e *Engine) Glosses(ctx context.Context, file string, from, to int) ([]Gloss, error) {
	var lo, hi sql.NullInt64
	if err := e.text.QueryRowContext(ctx, `SELECT MIN(e.id), MAX(e.id) FROM entry e JOIN file f ON f.id = e.file_id
		WHERE f.name = ? AND e.page_idx BETWEEN ? AND ?`, file, from, to).Scan(&lo, &hi); err != nil {
		return nil, err
	}
	out := []Gloss{}
	if !lo.Valid {
		return out, nil
	}
	// this side (s, se) and the other (o, oe)
	side, s, se, o, oe := "t", "m", "me", "a", "ae"
	if strings.HasPrefix(file, "atta-") {
		side, s, se, o, oe = "c", "a", "ae", "m", "me"
	}
	col := map[string]string{"a": "g.a_entry", "ae": "g.a_eentry", "m": "g.m_entry", "me": "g.m_eentry"}
	w := map[string]string{"a": "g.a_w", "ae": "g.a_ew", "m": "g.m_w", "me": "g.m_ew"}
	rows, err := e.text.QueryContext(ctx, `SELECT g.id, s.page_idx, s.entry_idx, `+w[s]+`, se.page_idx, se.entry_idx, `+w[se]+`,
		f.name, IFNULL(n.key, ''), o.page_idx, o.entry_idx, `+w[o]+`, oe.page_idx, oe.entry_idx, `+w[oe]+`,
		x.page_idx, x.entry_idx, g.x_w + 1, g.conf, g.src
		FROM gloss g JOIN entry s ON s.id = `+col[s]+` JOIN entry se ON se.id = `+col[se]+`
		JOIN entry o ON o.id = `+col[o]+` JOIN entry oe ON oe.id = `+col[oe]+` JOIN entry x ON x.id = g.x_entry
		JOIN file f ON f.id = o.file_id LEFT JOIN node n ON n.id = o.node_id
		WHERE g.id IN (SELECT id FROM gloss WHERE `+col[s][2:]+` BETWEEN ?1 AND ?2 UNION SELECT id FROM gloss WHERE `+col[se][2:]+` BETWEEN ?1 AND ?2)
		ORDER BY `+col[s]+`, `+w[s]+` LIMIT ?3`, lo.Int64, hi.Int64, maxGlosses)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		g := Gloss{Side: side}
		if err := rows.Scan(&g.G, &g.P, &g.E, &g.W, &g.EP, &g.EE, &g.EW, &g.File, &g.Key, &g.TP, &g.TE, &g.TW, &g.TEP, &g.TEE, &g.TEW,
			&g.XP, &g.XE, &g.XW, &g.Conf, &g.Src); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}
