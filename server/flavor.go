package main

import (
	"net/http"
	"strings"
)

// flavor: what differs between tipitaka.lk and the pitaka.lk reader (-flavor pitaka, dev-docs/pitaka-flavor.md).
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
}

var flavors = map[string]flavor{
	"lk": {name: "lk", textDB: "text.db", distDirs: []string{"web/dist", "dist"}, site: "https://tipitaka.lk",
		siteName: "බුද්ධ ජයන්ති ත්‍රිපිටකය", langs: true, legacy: true},
	"pitaka": {name: "pitaka", textDB: "pitaka-text.db", distDirs: []string{"web-pitaka/dist", "dist"}, site: "https://pitaka.lk/main",
		siteName: "සරල ත්‍රිපිටකය", base: "/main"},
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
