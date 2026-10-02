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
)

// SSR-lite: for sutta routes /<key>[/<p>-<e>][/<lang>] the index.html gets the page title, description,
// canonical/og tags, an <article id="ssr"> with the text (visible before the JS loads and for crawlers)
// and <script id="ssr-data"> with the exact named query results the reader needs (pre-fills the client cache).

var reservedRoutes = map[string]bool{"": true, "settings": true, "abbreviations": true, "bookmarks": true,
	"title": true, "dict": true, "fts": true}

var (
	eIndRe   = regexp.MustCompile(`^(\d+)-(\d+)$`)
	titleRe  = regexp.MustCompile(`(?s)<title>.*?</title>`)
	descRe   = regexp.MustCompile(`<meta name="description"[^>]*>`)
	appDivRe = regexp.MustCompile(`<div id="app"></div>`)
)

const siteURL = "https://tipitaka.lk"

type route struct {
	key, lang string
	eInd      []int // nil when not given
	langGiven bool
}

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
		kj, _ := marshalNoEscape(k)
		vj, _ := marshalNoEscape(params[k])
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
	base := strings.Replace(a.indexHTML, "</head>", fmt.Sprintf(`<meta name="tipitaka-api" content="%s"></head>`, a.apiHash), 1)
	r, ok := parseSuttaRoute(path)
	if !ok {
		first := strings.Split(strings.Trim(path, "/"), "/")[0]
		if reservedRoutes[first] {
			return ssrPage{200, base}
		}
		return ssrPage{404, base}
	}
	call := func(name string, params map[string]any, data map[string]any) []Row {
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
	if node.Int("pali_only") == 1 {
		lang = "pali"
	}
	name := func(row Row) string {
		if lang == "sinh" && row.Str("sinh") != "" {
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
		crumbs.WriteString(fmt.Sprintf(`<a href="/%s/%s">%s</a>`, pr.Str("key"), lang, html.EscapeString(name(pr))))
		if i > 0 {
			crumbs.WriteString(" › ")
		}
	}
	fullTitle := title + " | බුද්ධ ජයන්ති ත්‍රිපිටකය"
	desc := describe(r, node.Str("collection"), p)
	canonical := siteURL + "/" + strings.Trim(path, "/")

	var art strings.Builder
	art.WriteString(`<article id="ssr" lang="si"><nav class="ssr-crumbs">` + crumbs.String() + `</nav>`)
	textCol, typeCol, levelCol := "p_text", "p_type", "p_level"
	if lang == "sinh" {
		textCol, typeCol, levelCol = "s_text", "s_type", "s_level"
	}
	for _, e := range entries {
		if e.Int("page_idx") == p && e.Int("entry_idx") < startEntry {
			continue
		}
		t := e.Int(typeCol)
		if t < 0 || t >= len(typeNames) {
			t = e.Int("p_type")
		}
		art.WriteString(fmt.Sprintf(`<div class="ssr-entry %s" data-level="%d">%s</div>`, typeNames[t], e.Int(levelCol), MarkupToHTML(e.Str(textCol), true)))
	}
	art.WriteString(`</article>`)

	var dataJSON bytes.Buffer
	enc := json.NewEncoder(&dataJSON) // escapes < > & so the payload can not close the script tag
	enc.Encode(data)

	head := fmt.Sprintf(`<meta name="description" content="%[2]s">
<link rel="canonical" href="%[3]s">
<meta property="og:title" content="%[1]s">
<meta property="og:description" content="%[2]s">
<meta property="og:url" content="%[3]s">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","name":%[4]s,"description":%[5]s,"publisher":{"@type":"Organization","name":"Path Nirvana Foundation"}}</script>`,
		html.EscapeString(fullTitle), html.EscapeString(desc), html.EscapeString(canonical), jsonStr(fullTitle), jsonStr(desc))

	out := titleRe.ReplaceAllLiteralString(base, "<title>"+html.EscapeString(fullTitle)+"</title>")
	out = descRe.ReplaceAllLiteralString(out, "")
	out = strings.Replace(out, "</head>", head+"</head>", 1)
	out = appDivRe.ReplaceAllLiteralString(out, art.String()+`<div id="app"></div><script type="application/json" id="ssr-data">`+strings.TrimSpace(dataJSON.String())+`</script>`)
	return ssrPage{200, out}
}

func jsonStr(s string) string {
	var b bytes.Buffer
	enc := json.NewEncoder(&b)
	enc.Encode(s)
	return strings.TrimSpace(b.String())
}

// same text as the v2 bot renderer (GetDescription + db/template.html)
func describe(r route, collection string, page int) string {
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
	_ = collection
	return fmt.Sprintf("%s - %s%s පාළි සිංහල ත්‍රිපිටකය සහ අටුවාව Sri Lankan Tripitaka and Atuwa in Sinhala, Sinhala translations සිංහල පරිවර්තනය.", col, lang, pageStr)
}

func (a *App) serveIndex(w http.ResponseWriter, r *http.Request) {
	page := a.renderIndex(r.Context(), r.URL.Path)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(page.status)
	w.Write([]byte(page.html))
}
