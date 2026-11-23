package main

import (
	"context"
	"net/http"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

// The urls of the open.tipitaka.lk of 2025 (repo tipitaka-new), which the open flavor replaces: 301 to where the page
// is now (dev-docs/open-flavor.md "Old urls").
//
//	/<script>/book/<1..57>                 -> /<script>/<the first text of the book>
//	/<script>/<key>/full                   -> /<script>/<key>
//	/<collections joined with +>[/...]     a collection is a script or a translation:
//	    sin_apz, sin_sarala_ai             -> https://pitaka.lk/main/<key> (the simple Sinhala translation moved there)
//	    sin_bjt                            -> https://tipitaka.lk/<key>[/sinh]
//	/help/...                              -> /
//
// Its tree keys are ours (9,413 of 9,414; oldKeys has the other one), and /search/<words> and /bookmarks are still pages.
// Not redirected (the maintainer's decision): its positions /<script>/<key>/<printed page>-<seq>, which have the shape
// of ours (<page_idx>-<entry_idx>) with other numbers - an old link opens the right sutta at another paragraph - and
// its collections pali and eng_thani.
var (
	oldTranslations = []string{"sin_bjt", "sin_apz", "sin_sarala_ai"}
	oldKeys         = map[string]string{"kn-ps-1-1-16": "kn-ps-1-1-17"}
	oldKeyRe        = regexp.MustCompile(`^[a-z]+(-[a-z0-9]+)*$`)
)

func (a *App) withOldOpenURLs(h http.Handler) http.Handler {
	if !a.fl.scripts {
		return h
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet || r.Method == http.MethodHead {
			if to := a.oldOpenURL(r.Context(), r.URL.Path); to != "" {
				w.Header().Set("Cache-Control", "public, max-age=86400")
				http.Redirect(w, r, to, http.StatusMovedPermanently)
				return
			}
		}
		h.ServeHTTP(w, r)
	})
}

// oldOpenURL: where an old url is now, "" for a url of this site
func (a *App) oldOpenURL(ctx context.Context, path string) string {
	segs := strings.Split(strings.Trim(path, "/"), "/")
	if segs[0] == "help" {
		return "/"
	}
	script, trans := "", map[string]bool{}
	colls := strings.Split(segs[0], "+")
	for _, c := range colls {
		switch {
		case slices.Contains(oldTranslations, c):
			trans[c] = true
		case !slices.Contains(Scripts, c):
			return ""
		case script == "":
			script = c
		}
	}
	ours := len(colls) == 1 && script != "" // /<script>/...: old or new
	key, rest := "", segs[1:]
	switch {
	case len(rest) == 0:
	case rest[0] == "book" && len(rest) == 2:
		n, _ := strconv.Atoi(rest[1])
		rows, err := a.RunNamed(ctx, "old.book", map[string]any{"book": n})
		if err != nil || len(rows) == 0 {
			return ""
		}
		key = rows[0].Str("key")
	case len(rest) <= 2 && oldKeyRe.MatchString(rest[0]) && !(ours && reservedRoutes[rest[0]]):
		key = rest[0]
		if ours && !(len(rest) == 2 && rest[1] == "full") && oldKeys[key] == "" {
			return ""
		}
	default:
		return ""
	}
	if k := oldKeys[key]; k != "" {
		key = k
	}
	switch {
	case trans["sin_apz"] || trans["sin_sarala_ai"]:
		return flavors["pitaka"].site + "/" + key
	case trans["sin_bjt"] && key == "":
		return flavors["lk"].site + "/"
	case trans["sin_bjt"] && script == "":
		return flavors["lk"].site + "/" + key + "/sinh"
	case trans["sin_bjt"]: // with the pāḷi beside it
		return flavors["lk"].site + "/" + key
	case key == "" && ours:
		return ""
	case key == "": // several scripts
		return "/" + script + "/"
	}
	return "/" + script + "/" + key
}
