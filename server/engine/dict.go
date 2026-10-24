package engine

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
)

// Dict is a dictionary of dict.db.
type Dict struct {
	ID      int    `json:"-"`
	Code    string `json:"code"`
	Lang    string `json:"lang"`
	Name    string `json:"name"`
	Short   string `json:"short"`
	Desc    string `json:"desc,omitempty"`
	Origin  string `json:"origin,omitempty"`
	Entries int    `json:"entries"`
	// not used unless chosen: not part of "all dictionaries" (dicts empty)
	OptIn bool `json:"optIn,omitempty"`
	// abbreviations used in the meanings (<abbr data-a>), abbreviation -> expansion
	Abbrevs map[string]string `json:"abbrevs,omitempty"`
}

// DictEntry is a dictionary meaning.
type DictEntry struct {
	Dict    string `json:"dict"`
	Word    string `json:"word"`
	Hom     int    `json:"hom,omitempty"` // homonym number
	Meaning string `json:"meaning"`       // html (build/dicts/markup.ts), sanitised by the client
	Dist    int    `json:"dist"`
	id      int64
}

// DpdHead is a DPD headword.
type DpdHead struct {
	ID                   int      `json:"id"`
	Lemma                string   `json:"lemma"`
	Pos                  string   `json:"pos"`
	Grammar              string   `json:"grammar"`
	Meaning              string   `json:"meaning"`
	MeaningLit           string   `json:"meaningLit,omitempty"`
	Meaning2             string   `json:"meaning2,omitempty"`
	Construction         string   `json:"construction,omitempty"`
	RootKey              string   `json:"rootKey,omitempty"`
	RootBase             string   `json:"rootBase,omitempty"`
	DerivedFrom          string   `json:"derivedFrom,omitempty"`
	Sanskrit             string   `json:"sanskrit,omitempty"`
	PlusCase             string   `json:"plusCase,omitempty"`
	CompoundType         string   `json:"compoundType,omitempty"`
	CompoundConstruction string   `json:"compoundConstruction,omitempty"`
	Notes                string   `json:"notes,omitempty"`
	Stem                 string   `json:"stem,omitempty"`
	Pattern              string   `json:"pattern,omitempty"`
	Example              string   `json:"example,omitempty"`
	Source               string   `json:"source,omitempty"`
	Sutta                string   `json:"sutta,omitempty"`
	EbtCount             int      `json:"ebtCount"`
	Root                 *DpdRoot `json:"root,omitempty"`
}

// DpdRoot is a DPD root.
type DpdRoot struct {
	Root            string `json:"root"`
	Meaning         string `json:"meaning"`
	Group           int    `json:"group"`
	Sign            string `json:"sign"`
	SanskritRoot    string `json:"sanskritRoot,omitempty"`
	SanskritMeaning string `json:"sanskritMeaning,omitempty"`
}

// Breakup is a compound / sandhi split (v2 breakups).
type Breakup struct {
	Word   string          `json:"word"`
	Type   string          `json:"type"`
	Origin string          `json:"origin"`
	Parts  json.RawMessage `json:"parts"`
}

// DictResult is the response of Dict and Lookup.
type DictResult struct {
	Word     string      `json:"word"`
	Entries  []DictEntry `json:"entries"`
	Dpd      []DpdHead   `json:"dpd"`
	Breakups []Breakup   `json:"breakups"`
	// Lookup only: DPD analysis of the inflected form
	Grammar       json.RawMessage `json:"grammar,omitempty"`       // [[lemma, pos, grammar], ...]
	Deconstructor json.RawMessage `json:"deconstructor,omitempty"` // ["a + b", ...]
	Spelling      string          `json:"spelling,omitempty"`
	See           string          `json:"see,omitempty"`
	Abbrev        string          `json:"abbrev,omitempty"`
}

// Dicts lists the dictionaries.
func (e *Engine) Dicts(ctx context.Context) ([]Dict, error) {
	if e.dict == nil {
		return []Dict{}, nil
	}
	rows, err := e.dict.QueryContext(ctx, "SELECT id, code, lang, name, short, descr, origin, entries, opt_in FROM dict ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Dict{}
	for rows.Next() {
		var d Dict
		if err := rows.Scan(&d.ID, &d.Code, &d.Lang, &d.Name, &d.Short, &d.Desc, &d.Origin, &d.Entries, &d.OptIn); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	// dict_abbrev is missing in dict.db files built before it
	if ar, err := e.dict.QueryContext(ctx, "SELECT dict_id, abbr, expansion FROM dict_abbrev"); err == nil {
		defer ar.Close()
		byID := map[int]*Dict{}
		for i := range out {
			byID[out[i].ID] = &out[i]
		}
		for ar.Next() {
			var id int
			var a, x string
			if err := ar.Scan(&id, &a, &x); err != nil {
				return nil, err
			}
			if d := byID[id]; d != nil {
				if d.Abbrevs == nil {
					d.Abbrevs = map[string]string{}
				}
				d.Abbrevs[a] = x
			}
		}
		if err := ar.Err(); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func placeholders(n int) string { return strings.Repeat(",?", n)[1:] }

// Dictionary looks up a typed word: exact (diacritic-insensitive unless it has diacritics) or a * ? pattern,
// falling back to a prefix search when nothing matches. dicts limits the dictionaries (codes), DPD is "dpd";
// none: all but the opt-in dictionaries.
func (e *Engine) Dictionary(ctx context.Context, word string, dicts []string, limit int) (*DictResult, error) {
	if e.dict == nil {
		return nil, ErrNoDict
	}
	w := glob(NormalizeWord(strings.TrimSpace(word)))
	res := &DictResult{Word: w, Entries: []DictEntry{}, Dpd: []DpdHead{}, Breakups: []Breakup{}}
	if strings.Trim(w, "*?") == "" {
		return res, nil
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	useDpd := len(dicts) == 0
	var codes []string
	for _, d := range dicts {
		if d == "dpd" {
			useDpd = true
		} else {
			codes = append(codes, d)
		}
	}
	f := Fold(w)
	sensitive := HasDiacritics(w)
	// run queries the folded column; when the word has diacritics the exact column must match too.
	// A variant headword (alias_of) shows the entry it belongs to, once.
	seen := map[int64]bool{}
	run := func(op, foldPat, wordPat string) error {
		q := `SELECT COALESCE(e.alias_of, e.id), d.code, e.word, COALESCE(m.word, e.word), e.hom, COALESCE(m.meaning, e.meaning)
			FROM entry e JOIN dict d ON d.id = e.dict_id LEFT JOIN entry m ON m.id = e.alias_of WHERE e.fold ` + op + " ?"
		args := []any{foldPat}
		if sensitive {
			q += " AND e.word " + op + " ?"
			args = append(args, wordPat)
		}
		if len(dicts) == 0 {
			q += " AND d.opt_in = 0"
		} else {
			if len(codes) == 0 {
				return nil
			}
			q += " AND d.code IN (" + placeholders(len(codes)) + ")"
			for _, c := range codes {
				args = append(args, c)
			}
		}
		q += " LIMIT 1000"
		rows, err := e.dict.QueryContext(ctx, q, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var de DictEntry
			var id int64
			var matched string
			if err := rows.Scan(&id, &de.Dict, &matched, &de.Word, &de.Hom, &de.Meaning); err != nil {
				return err
			}
			de.Dist = Levenshtein(Fold(matched), strings.Trim(f, "*?"))
			if seen[id] {
				// the entry and its variant both matched: keep the closer one
				for i := range res.Entries {
					if res.Entries[i].id == id && de.Dist < res.Entries[i].Dist {
						res.Entries[i].Dist = de.Dist
					}
				}
				continue
			}
			seen[id] = true
			de.id = id
			res.Entries = append(res.Entries, de)
		}
		return rows.Err()
	}
	if strings.ContainsAny(f, "*?") {
		if err := run("GLOB", f, w); err != nil {
			return nil, err
		}
	} else {
		if err := run("=", f, w); err != nil {
			return nil, err
		}
		if len(res.Entries) == 0 {
			if err := run("GLOB", f+"*", w+"*"); err != nil {
				return nil, err
			}
		}
	}
	order := map[string]int{}
	if ds, err := e.Dicts(ctx); err == nil {
		for i, d := range ds {
			order[d.Code] = i
		}
	}
	sort.SliceStable(res.Entries, func(a, b int) bool {
		ea, eb := res.Entries[a], res.Entries[b]
		if ea.Dist != eb.Dist {
			return ea.Dist < eb.Dist
		}
		return order[ea.Dict] < order[eb.Dict]
	})
	if len(res.Entries) > limit {
		res.Entries = res.Entries[:limit]
	}
	if useDpd {
		pat, op := f, "="
		if strings.ContainsAny(f, "*?") {
			op = "GLOB"
		}
		heads, err := e.dpdHeads(ctx, "fold "+op+" ?", []any{pat}, 50)
		if err != nil {
			return nil, err
		}
		if len(heads) == 0 && op == "=" {
			if heads, err = e.dpdHeads(ctx, "fold GLOB ?", []any{f + "*"}, 30); err != nil {
				return nil, err
			}
		}
		res.Dpd = heads
	}
	bs, err := e.breakups(ctx, f)
	if err != nil {
		return nil, err
	}
	res.Breakups = bs
	return res, nil
}

const dpdCols = `id, lemma, pos, grammar, meaning, meaning_lit, meaning_2, construction, root_key, root_base, derived_from, sanskrit,
	plus_case, compound_type, compound_construction, notes, stem, pattern, example, source, sutta, ebt_count`

func (e *Engine) dpdHeads(ctx context.Context, where string, args []any, limit int) ([]DpdHead, error) {
	rows, err := e.dict.QueryContext(ctx, "SELECT "+dpdCols+" FROM dpd_head WHERE "+where+" ORDER BY id LIMIT ?", append(args, limit)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []DpdHead{}
	for rows.Next() {
		var h DpdHead
		if err := rows.Scan(&h.ID, &h.Lemma, &h.Pos, &h.Grammar, &h.Meaning, &h.MeaningLit, &h.Meaning2, &h.Construction, &h.RootKey,
			&h.RootBase, &h.DerivedFrom, &h.Sanskrit, &h.PlusCase, &h.CompoundType, &h.CompoundConstruction, &h.Notes, &h.Stem,
			&h.Pattern, &h.Example, &h.Source, &h.Sutta, &h.EbtCount); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range out {
		if out[i].RootKey != "" {
			out[i].Root = e.dpdRoot(ctx, out[i].RootKey)
		}
	}
	return out, nil
}

func (e *Engine) dpdRoot(ctx context.Context, key string) *DpdRoot {
	var r DpdRoot
	err := e.dict.QueryRowContext(ctx, "SELECT root, meaning, root_group, sign, sanskrit_root, sanskrit_meaning FROM dpd_root WHERE root = ?", key).
		Scan(&r.Root, &r.Meaning, &r.Group, &r.Sign, &r.SanskritRoot, &r.SanskritMeaning)
	if err != nil {
		return nil
	}
	return &r
}

func (e *Engine) breakups(ctx context.Context, fold string) ([]Breakup, error) {
	out := []Breakup{}
	if strings.ContainsAny(fold, "*?") {
		return out, nil
	}
	rows, err := e.dict.QueryContext(ctx, "SELECT word, type, origin, parts FROM breakup WHERE fold = ? LIMIT 10", fold)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var b Breakup
		var parts string
		if err := rows.Scan(&b.Word, &b.Type, &b.Origin, &parts); err != nil {
			return nil, err
		}
		b.Parts = json.RawMessage(parts)
		out = append(out, b)
	}
	return out, rows.Err()
}

// Lookup analyses a word as it occurs in the text (tap on a word): the DPD inflection/deconstruction lookup,
// the headwords it belongs to and short dictionary entries for the word or its headwords. dicts limits the
// dictionaries as in Dictionary; without "dpd" the DPD headwords and analysis are left out.
func (e *Engine) Lookup(ctx context.Context, word string, dicts []string, limit int) (*DictResult, error) {
	if e.dict == nil {
		return nil, ErrNoDict
	}
	w := NormalizeWord(strings.Trim(word, " .,;:!?‘’'\"“”()–-"))
	w = strings.NewReplacer("‘", "", "’", "", "'", "").Replace(w)
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	res := &DictResult{Word: w, Entries: []DictEntry{}, Dpd: []DpdHead{}, Breakups: []Breakup{}}
	if w == "" {
		return res, nil
	}
	var headwords, roots, decon, grammar string
	err := e.dict.QueryRowContext(ctx, "SELECT headwords, roots, deconstructor, grammar, spelling, see, abbrev FROM dpd_lookup WHERE word = ?", w).
		Scan(&headwords, &roots, &decon, &grammar, &res.Spelling, &res.See, &res.Abbrev)
	if err == nil {
		if decon != "" {
			res.Deconstructor = json.RawMessage(decon)
		}
		if grammar != "" {
			res.Grammar = json.RawMessage(grammar)
		}
		var ids []int
		if headwords != "" && json.Unmarshal([]byte(headwords), &ids) == nil && len(ids) > 0 {
			if len(ids) > 60 {
				ids = ids[:60]
			}
			args := make([]any, len(ids))
			for i, id := range ids {
				args[i] = id
			}
			heads, err := e.dpdHeads(ctx, "id IN ("+placeholders(len(ids))+")", args, len(ids))
			if err != nil {
				return nil, err
			}
			// keep the lookup order
			pos := map[int]int{}
			for i, id := range ids {
				pos[id] = i
			}
			sort.SliceStable(heads, func(a, b int) bool { return pos[heads[a].ID] < pos[heads[b].ID] })
			res.Dpd = heads
		}
	}
	// dictionary entries: the word itself, else the dictionary forms of its DPD headwords
	d, err := e.Dictionary(ctx, w, nonDpd(dicts), limit)
	if err != nil {
		return nil, err
	}
	exact := d.Entries[:0:0]
	for _, x := range d.Entries {
		if x.Dist == 0 {
			exact = append(exact, x)
		}
	}
	if len(exact) == 0 && len(res.Dpd) > 0 {
		seen := map[string]bool{}
		for _, h := range res.Dpd {
			lemma := strings.Fields(h.Lemma)[0]
			if seen[lemma] {
				continue
			}
			seen[lemma] = true
			d2, err := e.Dictionary(ctx, lemma, nonDpd(dicts), limit)
			if err != nil {
				return nil, err
			}
			for _, x := range d2.Entries {
				if x.Dist == 0 {
					exact = append(exact, x)
				}
			}
			if len(seen) >= 3 {
				break
			}
		}
	}
	if len(exact) > limit {
		exact = exact[:limit]
	}
	res.Entries = exact
	res.Breakups = d.Breakups
	if !hasDpd(dicts) {
		// DPD not chosen: its headwords found the dictionary forms above, but are not shown, nor its analysis
		res.Dpd = []DpdHead{}
		res.Grammar, res.Deconstructor = nil, nil
		res.Spelling, res.See, res.Abbrev = "", "", ""
	}
	return res, nil
}

// hasDpd: whether DPD is among the chosen dictionaries (none chosen: all are)
func hasDpd(dicts []string) bool {
	if len(dicts) == 0 {
		return true
	}
	for _, d := range dicts {
		if d == "dpd" {
			return true
		}
	}
	return false
}

// nonDpd returns the dictionary codes without dpd (nil = all dictionaries).
func nonDpd(dicts []string) []string {
	if len(dicts) == 0 {
		return nil
	}
	var out []string
	for _, d := range dicts {
		if d != "dpd" {
			out = append(out, d)
		}
	}
	if len(out) == 0 {
		return []string{"-"} // only dpd selected: no other dictionary
	}
	return out
}
