package main

import (
	"context"
	"net/http"
	"regexp"
	"slices"
	"strings"

	"tipitaka.lk/server/engine"
)

// flavor: what differs between tipitaka.lk, the pitaka.lk reader (-flavor pitaka, dev-docs/pitaka-flavor.md) and
// open.tipitaka.lk (-flavor open, dev-docs/open-flavor.md).
// The pitaka.lk reader is served under /main (nginx sends pitaka.lk/main/ here): its db is db/pitaka-text.db (the BJT
// pāḷi with the simplified Sinhala translation, build/pitaka.ts) and its web app web-pitaka/.
type flavor struct {
	name     string
	textDB   string   // in the db folder
	distDirs []string // the web build: repo checkout first, release layout second
	site     string   // default public url
	siteName string   // page titles, og:site_name
	base     string   // url prefix of everything served ("" or "/main")
	langs    bool     // a sutta is two pages, /<key>/pali and /<key>/sinh (pitaka: one page, the translation)
	legacy   bool     // the v2 endpoints /tipitaka-query/*, /bjt-scanned-pages/
	scripts  bool     // open: the pāḷi alone, in the script of the url (/<script>/<key>); the text is converted in the browser
}

var flavors = map[string]flavor{
	"lk": {name: "lk", textDB: "text.db", distDirs: []string{"web/dist", "dist"}, site: "https://tipitaka.lk",
		siteName: "බුද්ධ ජයන්ති ත්‍රිපිටකය", langs: true, legacy: true},
	"pitaka": {name: "pitaka", textDB: "pitaka-text.db", distDirs: []string{"web-pitaka/dist", "dist"}, site: "https://pitaka.lk/main",
		siteName: "සරල සිංහල ත්‍රිපිටකය", base: "/main"},
	// open.tipitaka.lk (dev-docs/open-flavor.md): tipitaka.lk's text.db, the pāḷi in the scripts of shared/scripts.ts
	"open": {name: "open", textDB: "text.db", distDirs: []string{"web-open/dist", "dist"}, site: "https://open.tipitaka.lk",
		siteName: "Buddha Jayanti Tipitaka", scripts: true},
}

// Scripts: the pāḷi scripts of the open flavor's urls, as shared/scripts.ts SCRIPTS (@pnfo/pali-converter's codes)
var Scripts = []string{"latn", "sinh", "deva", "thai", "mymr", "khmr", "laoo", "beng", "tibt", "cyrl", "guru", "gujr",
	"telu", "knda", "mlym", "taml", "asse", "lana", "brah", "cakm", "java", "bali"}

type scriptCtxKey struct{}

// scriptOf: the script of the request's url ("" when it has none: the web app then goes to the reader's script)
func scriptOf(ctx context.Context) string { s, _ := ctx.Value(scriptCtxKey{}).(string); return s }

// the texts the open flavor does not have (yet): the aṭṭhakathā and the other books. As SEARCH_KEYS of
// web-open/src/composables/searchFilter.ts: to add them, change both
var hiddenKeyRe = regexp.MustCompile(`^(atta-|anya)`)

// scope: the rows of a named query as the flavor serves them (the api and the pages). open: no aṭṭhakathā / anya
// (tree, title index, texts, search results) and the pāḷi alone: the Sinhala names, translation and footnotes are left out
func (f flavor) scope(name string, params map[string]any, rows []engine.Row) []engine.Row {
	if !f.scripts {
		return rows
	}
	for _, p := range []string{"file", "key"} {
		if s, _ := params[p].(string); hiddenKeyRe.MatchString(s) {
			return []engine.Row{}
		}
	}
	out := rows[:0]
	for _, r := range rows {
		if hiddenKeyRe.MatchString(r.Str("key")) || hiddenKeyRe.MatchString(r.Str("file")) || (name == "text.footnotes" && r.Int("lang") != 0) {
			continue
		}
		for _, c := range []string{"sinh", "s_text", "mirror_key"} {
			r.Set(c, "")
		}
		out = append(out, r)
	}
	return out
}

// withScripts: /<script>/x is /x to h, the script in the request's context (scriptOf): the web app reads it from the
// url, the server renders the page in it (ssr_open.go)
func (f flavor) withScripts(h http.Handler) http.Handler {
	if !f.scripts {
		return h
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seg, rest, _ := strings.Cut(strings.TrimPrefix(r.URL.Path, "/"), "/")
		if slices.Contains(Scripts, seg) {
			r = r.Clone(context.WithValue(r.Context(), scriptCtxKey{}, seg))
			r.URL.Path, r.URL.RawPath = "/"+rest, ""
		}
		h.ServeHTTP(w, r)
	})
}

// withBase serves h under the flavor's base path: /main/x is /x to h, / goes to /main/, anything else is not ours
func (f flavor) withBase(h http.Handler) http.Handler {
	if f.base == "" {
		return h
	}
	strip := http.StripPrefix(f.base, h)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, f.base+"/"):
			strip.ServeHTTP(w, r)
		case r.URL.Path == "/" || r.URL.Path == f.base:
			http.Redirect(w, r, f.base+"/", http.StatusMovedPermanently)
		default:
			http.NotFound(w, r)
		}
	})
}
