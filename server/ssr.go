package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"log"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"tipitaka.lk/server/engine"
)

// SSR-lite: for sutta routes /<key>[/<p>-<e>][/<lang>] the index.html gets the page title, description,
// canonical/og tags, an <article id="ssr"> with the text (visible before the JS loads and for crawlers)
// and <script id="ssr-data"> with the exact named query results the reader needs (pre-fills the client cache).
// The pitaka flavor (flavor.go) has no /<lang>: its page is the translation, with the pāḷi where an entry has none.

var reservedRoutes = map[string]bool{"": true, "settings": true, "abbreviations": true, "bookmarks": true,
	"title": true, "dict": true, "fts": true, "map": true, "names": true, "help": true}

var (
	eIndRe   = regexp.MustCompile(`^(\d+)-(\d+)$`)
	titleRe  = regexp.MustCompile(`(?s)<title>.*?</title>`)
	descRe   = regexp.MustCompile(`<meta name="description"[^>]*>`)
	appDivRe = regexp.MustCompile(`<div id="app"></div>`)
)

var htmlTagRe = regexp.MustCompile(`<[^>]*>`)

// plainText of an entry (description): the html of the markup without tags and entities
func plainText(markup string) string {
	t := html.UnescapeString(htmlTagRe.ReplaceAllString(MarkupToHTML(markup, true), ""))
	return strings.Join(strings.Fields(t), " ")
}

// cut at a word boundary below max runes
func cut(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	t := string(r[:max])
	if i := strings.LastIndex(t, " "); i > max/2 {
		t = t[:i]
	}
	return strings.TrimRight(t, " ,.;:") + "…"
}

type route struct {
	key, lang string
	eInd      []int // nil when not given
	langGiven bool
}

// parseSuttaRoute: /<key>[/<p>-<e>][/pali|/sinh] (pitaka: the language picks the reading mode, the page is the same)
func parseSuttaRoute(path string) (route, bool) {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 1 || len(parts) > 3 || reservedRoutes[parts[0]] {
		return route{}, false
	}
	r := route{key: parts[0], lang: "pali"}
	rest := parts[1:]
	if n := len(rest); n > 0 && (rest[n-1] == "pali" || rest[n-1] == "sinh") {
		r.lang, r.langGiven = rest[n-1], true
		rest = rest[:n-1]
	}
	if len(rest) == 1 {
		m := eIndRe.FindStringSubmatch(rest[0])
		if m == nil {
			return route{}, false
		}
		p, _ := strconv.Atoi(m[1])
		e, _ := strconv.Atoi(m[2])
		r.eInd = []int{p, e}
	} else if len(rest) > 1 {
		return route{}, false
	}
	return r, true
}

// cacheKey must equal web/src/data/cache.ts cacheKey(): name|JSON(params with sorted keys)
func cacheKey(name string, params map[string]any) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	b.WriteString(name + "|{")
	for i, k := range keys {
		if i > 0 {
			b.WriteByte(',')
		}
		kj, _ := engine.MarshalNoEscape(k)
		vj, _ := engine.MarshalNoEscape(params[k])
		b.Write(kj)
		b.WriteByte(':')
		b.Write(vj)
	}
	b.WriteString("}")
	return b.String()
}

type ssrPage struct {
	status int
	html   string
}

var typeNames = []string{"centered", "heading", "paragraph", "gatha", "unindented"}

func (a *App) renderIndex(ctx context.Context, path string) ssrPage {
	index, _ := a.currentIndex()
	base := strings.Replace(index, "</head>", fmt.Sprintf(`<meta name="tipitaka-api" content="%s"><meta name="tipitaka-ops" content="%s"></head>`, a.apiHash, a.opsHash), 1)
	r, ok := parseSuttaRoute(path)
	if !ok {
		first := strings.Split(strings.Trim(path, "/"), "/")[0]
		if reservedRoutes[first] {
			return ssrPage{200, base}
		}
		return ssrPage{404, base}
	}
	call := func(name string, params map[string]any, data map[string]any) []engine.Row {
		rows, err := a.RunNamed(ctx, name, params)
		if err != nil {
			log.Printf("ssr %s %v: %v", name, params, err)
			return nil
		}
		data[cacheKey(name, params)] = rows
		return rows
	}
	data := map[string]any{}
	nodes := call("tree.node", map[string]any{"key": r.key}, data)
	if len(nodes) == 0 {
		return ssrPage{404, base}
	}
	node := nodes[0]
	file := node.Str("file")
	// start position: the given eInd if valid, else the node's own position (same as the reader)
	p, startEntry := node.Int("page_idx"), node.Int("entry_idx")
	if r.eInd != nil && r.eInd[0] < node.Int("page_count") {
		p, startEntry = r.eInd[0], r.eInd[1]
	}
	paths := call("tree.paths", map[string]any{"ids": strconv.Itoa(node.Int("id"))}, data)
	pageParams := map[string]any{"file": file, "from": p, "to": p + 1}
	entries := call("text.entries", pageParams, data)
	call("text.footnotes", pageParams, data)

	lang := r.lang
	paliOnly := node.Int("pali_only") == 1
	pitaka := !a.fl.langs
	if pitaka && !paliOnly && !(r.langGiven && lang == "pali") { // a /pali link shows the pāḷi (pitaka.lk's pali mode)
		lang = "sinh"
	}
	if paliOnly {
		lang = "pali"
	}
	name := func(row engine.Row) string {
		if (lang == "sinh" || pitaka) && row.Str("sinh") != "" {
			return row.Str("sinh")
		}
		return row.Str("pali")
	}
	// title: "<name> < <root name>" (Home.vue metaInfo)
	title := name(node)
	keyRoot := strings.Split(r.key, "-")[0]
	if keyRoot == "atta" && len(strings.Split(r.key, "-")) > 1 {
		keyRoot = "atta-" + strings.Split(r.key, "-")[1]
	}
	var crumbs strings.Builder
	for i := len(paths) - 1; i >= 0; i-- {
		pr := paths[i]
		if pr.Str("key") == keyRoot && keyRoot != r.key {
			title += " < " + name(pr)
		}
		crumbs.WriteString(fmt.Sprintf(`<a href="%s">%s</a>`, a.pagePath(pr.Str("key"), lang), html.EscapeString(name(pr))))
		if i > 0 {
			crumbs.WriteString(" › ")
		}
	}
	fullTitle := title + " | " + a.fl.siteName
	// one canonical page per sutta and language (/key, /key/<p>-<e>/pali ... are the same page); hreflang pairs the
	// pali text with its sinhala translation
	pageURL := func(l string) string { return a.site + strings.TrimPrefix(a.pagePath(r.key, l), a.fl.base) }
	canonical := pageURL(lang)
	inLang := map[string]string{"pali": "pi", "sinh": "si"}[lang]

	var art strings.Builder
	art.WriteString(`<article id="ssr" lang="` + inLang + `"><nav class="ssr-crumbs">` + crumbs.String() + `</nav>`)
	desc := ""
	for _, e := range entries {
		if e.Int("page_idx") == p && e.Int("entry_idx") < startEntry {
			continue
		}
		textCol, typeCol, levelCol, attr := "p_text", "p_type", "p_level", ""
		if lang == "sinh" && (!pitaka || e.Str("s_text") != "") {
			textCol, typeCol, levelCol = "s_text", "s_type", "s_level"
		} else if lang == "sinh" {
			attr = ` lang="pi"` // pitaka: not translated
		}
		t := e.Int(typeCol)
		if t < 0 || t >= len(typeNames) {
			t = e.Int("p_type")
		}
		if desc == "" && typeNames[t] != "heading" && typeNames[t] != "centered" {
			desc = cut(plainText(e.Str(textCol)), 160) // the text itself describes the page best
		}
		art.WriteString(fmt.Sprintf(`<div class="ssr-entry %s" data-level="%d"%s>%s</div>`, typeNames[t], e.Int(levelCol), attr, MarkupToHTML(e.Str(textCol), true)))
	}
	if desc == "" {
		desc = a.describe(r, lang, p)
	}
	// the next sutta: a link for crawlers (and rel=next)
	next := ""
	if rows, err := a.RunNamed(ctx, "tree.neighbor", map[string]any{"id": node.Int("id"), "dir": 1}); err == nil && len(rows) > 0 && rows[0].Str("file") != "" {
		next = rows[0].Str("key")
		art.WriteString(fmt.Sprintf(`<nav class="ssr-next"><a href="%s" rel="next">ඊළඟ සූත්‍රය ›</a></nav>`, a.pagePath(next, lang)))
	}
	art.WriteString(`</article>`)

	var dataJSON bytes.Buffer
	enc := json.NewEncoder(&dataJSON) // escapes < > & so the payload can not close the script tag
	enc.Encode(data)

	var head strings.Builder
	fmt.Fprintf(&head, `<meta name="description" content="%[2]s">
<link rel="canonical" href="%[3]s">
<meta property="og:title" content="%[1]s">
<meta property="og:description" content="%[2]s">
<meta property="og:url" content="%[3]s">
<meta property="og:site_name" content="%[4]s">
<meta property="og:locale" content="si_LK">`, html.EscapeString(fullTitle), html.EscapeString(desc), html.EscapeString(canonical), a.fl.siteName)
	if a.fl.langs {
		fmt.Fprintf(&head, `<link rel="alternate" hreflang="pi" href="%s">`, pageURL("pali"))
		if !paliOnly {
			fmt.Fprintf(&head, `<link rel="alternate" hreflang="si" href="%s">`, pageURL("sinh"))
		}
		fmt.Fprintf(&head, `<link rel="alternate" hreflang="x-default" href="%s">`, pageURL("pali"))
	}
	if next != "" {
		fmt.Fprintf(&head, `<link rel="next" href="%s%s">`, a.site, strings.TrimPrefix(a.pagePath(next, lang), a.fl.base))
	}
	// schema.org: a book (top level) or a chapter of the book at the root of its path
	ld := map[string]any{"@context": "https://schema.org", "@type": "Chapter", "name": title, "description": desc, "url": canonical,
		"inLanguage": inLang, "publisher": map[string]any{"@type": "Organization", "name": "Path Nirvana Foundation", "url": a.site}}
	if len(paths) > 1 {
		root := paths[len(paths)-1]
		ld["isPartOf"] = map[string]any{"@type": "Book", "name": name(root), "url": a.site + strings.TrimPrefix(a.pagePath(root.Str("key"), lang), a.fl.base)}
	} else {
		ld["@type"] = "Book"
	}
	fmt.Fprintf(&head, `<script type="application/ld+json">%s</script>`, jsonStr(ld))

	out := titleRe.ReplaceAllLiteralString(base, "<title>"+html.EscapeString(fullTitle)+"</title>")
	out = descRe.ReplaceAllLiteralString(out, "")
	out = strings.Replace(out, "</head>", head.String()+"</head>", 1)
	out = appDivRe.ReplaceAllLiteralString(out, art.String()+`<div id="app"></div><script type="application/json" id="ssr-data">`+strings.TrimSpace(dataJSON.String())+`</script>`)
	return ssrPage{200, out}
}

func jsonStr(s any) string {
	var b bytes.Buffer
	enc := json.NewEncoder(&b)
	enc.Encode(s)
	return strings.TrimSpace(b.String())
}

// pagePath: the path of a sutta page, with the base (/main/dn-1, /dn-1/pali)
func (a *App) pagePath(key, lang string) string {
	if !a.fl.langs {
		return a.fl.base + "/" + key
	}
	return "/" + key + "/" + lang
}

// same text as the v2 bot renderer (GetDescription + db/template.html); pitaka: its own
func (a *App) describe(r route, lang string, page int) string {
	if !a.fl.langs {
		what := "සරල සිංහල පරිවර්තනය සහ පාළි පාඨය"
		if lang == "pali" {
			what = "පාළි පාඨය (සිංහල පරිවර්තනය ඉදිරියේදී)"
		}
		return fmt.Sprintf("%s - %s. Tipitaka in simple Sinhala with the Pali text.", a.fl.siteName, what)
	}
	col, lang, pageStr := "බුද්ධ ජයන්ති ත්‍රිපිටකය", "පාළි", ""
	if strings.HasPrefix(r.key, "atta") {
		col = "අටුවාව"
	} else if strings.HasPrefix(r.key, "anya") {
		col = "අන්‍ය ග්‍රන්ථ"
	}
	if r.lang == "sinh" {
		lang = "සිංහල"
	}
	if r.eInd != nil {
		pageStr = fmt.Sprintf("- %d පිටුව", page+1)
	}
	return fmt.Sprintf("%s - %s%s පාළි සිංහල ත්‍රිපිටකය සහ අටුවාව Sri Lankan Tripitaka and Atuwa in Sinhala, Sinhala translations සිංහල පරිවර්තනය.", col, lang, pageStr)
}

// render: a cached page, or a page rendered in one of the ssr slots (guard.go). ok false: no slot in time
func (a *App) render(ctx context.Context, path string) (ssrPage, bool) {
	a.currentIndex() // empties the cache when the web app was rebuilt
	if p, ok := a.ssr.get(path); ok {
		a.guard.stats.cacheHits.Add(1)
		return p, true
	}
	if !a.guard.ssr.acquire(ctx, ssrWait) {
		return ssrPage{}, false
	}
	defer a.guard.ssr.release()
	a.guard.stats.renders.Add(1)
	p := a.renderIndex(ctx, path)
	if p.status == 200 || p.status == 404 {
		a.ssr.put(path, p)
	}
	return p, true
}

func (a *App) serveIndex(w http.ResponseWriter, r *http.Request) {
	bot := isBot(r)
	if bot {
		a.guard.stats.botRequests.Add(1)
	}
	page, ok := a.render(r.Context(), r.URL.Path)
	if !ok {
		// busy: a crawler is asked to come back later, a person gets the app (it renders the page in the browser)
		w.Header().Set("Cache-Control", "no-store")
		if bot {
			a.guard.stats.shedBots.Add(1)
			w.Header().Set("Retry-After", retryBots)
			http.Error(w, "busy, please retry later", http.StatusServiceUnavailable)
			return
		}
		a.guard.stats.shedPeople.Add(1)
		index, _ := a.currentIndex()
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(strings.Replace(index, "</head>", fmt.Sprintf(`<meta name="tipitaka-api" content="%s"><meta name="tipitaka-ops" content="%s"></head>`, a.apiHash, a.opsHash), 1)))
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(page.status)
	w.Write([]byte(page.html))
}
