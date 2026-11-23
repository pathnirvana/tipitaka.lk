package main

import (
	"context"
	"fmt"
	"html"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	paliconv "github.com/pnfo/pali-converter"

	"tipitaka.lk/server/engine"
)

// The pages of open.tipitaka.lk (-flavor open, dev-docs/open-flavor.md): the pāḷi of tipitaka.lk's text.db in the
// script of the url, /<script>/<key>. The text is stored in Sinhala script; the server converts it with the Go port of
// @pnfo/pali-converter (the submodule server/pali-converter, at the commit package.json pins) as the web app does in the
// browser (web-open/src/script.ts), so a crawler and a reader before the JS loads see the page in its script.

// seoScripts are offered to search engines (sitemaps, hreflang): the first 9 of the script menu, as tipitaka.app
var seoScripts = Scripts[:9]

var scriptNames = map[string]string{"latn": "Roman", "sinh": "Sinhala", "deva": "Devanagari", "thai": "Thai", "mymr": "Myanmar",
	"khmr": "Khmer", "laoo": "Lao", "beng": "Bengali", "tibt": "Tibetan", "cyrl": "Cyrillic", "guru": "Gurmukhi", "gujr": "Gujarati",
	"telu": "Telugu", "knda": "Kannada", "mlym": "Malayalam", "taml": "Tamil", "asse": "Assamese", "lana": "Tai Tham",
	"brah": "Brahmi", "cakm": "Chakma", "java": "Javanese", "bali": "Balinese"}

// scriptTag: the BCP 47 tag of pāḷi in a script (shared/scripts.ts lang)
func scriptTag(s string) string {
	if s == "asse" {
		return "pi-Beng"
	}
	return "pi-" + strings.ToUpper(s[:1]) + s[1:]
}

// convTo: Sinhala script pāḷi in a script (web-open/src/script.ts convertTo)
func convTo(text, script string) string {
	if script == "sinh" || text == "" {
		return text
	}
	return paliconv.Convert(text, script, "sinh")
}

// a paragraph number in the digits of any script (Thai ๑., Myanmar ၁.)
var scriptParaNumRe = regexp.MustCompile(`^\s*\p{Nd}+(\s*[-–]\s*\p{Nd}+)?\s*\.\s*`)

var capNextRe = regexp.MustCompile(`[.?]\s+$|[“‘]$`)

// runConv converts the runs of one paragraph (web-open/src/script.ts convertRun): the converter capitalises Roman
// text at the start of a line and of a sentence; a run is not a line, so the first letter of a run is a capital only
// when it starts the paragraph, a line or a sentence
type runConv struct {
	script string
	cap    bool
}

func (c *runConv) conv(run string, lineStart bool) string {
	if c.script != "latn" {
		return convTo(run, c.script)
	}
	if lineStart {
		c.cap = true
	}
	if strings.TrimSpace(run) == "" {
		return run
	}
	v := strings.Replace(convTo("⁠"+run, "latn"), "⁠", "", 1) // the mark takes the place of the line's first letter
	if c.cap {
		if i := strings.IndexFunc(v, func(r rune) bool { return !unicode.IsSpace(r) }); i >= 0 {
			r, n := utf8.DecodeRuneInString(v[i:])
			v = v[:i] + string(unicode.ToUpper(r)) + v[i+n:]
		}
	}
	c.cap = capNextRe.MatchString(v)
	return v
}

var htmlTagOpenRe = regexp.MustCompile(`<html[^>]*>`)

// alternates: the hreflang links of a page (path: the url path after the script, "/dn-1-1")
func (a *App) alternates(head *strings.Builder, path string) {
	for _, s := range seoScripts {
		fmt.Fprintf(head, `<link rel="alternate" hreflang="%s" href="%s/%s%s">`, scriptTag(s), a.site, s, path)
	}
	fmt.Fprintf(head, `<link rel="alternate" hreflang="x-default" href="%s/latn%s">`, a.site, path)
}

// scriptShell: index.html of a page that is not a text. With a script: the html element says it (the fonts apply
// before the JS runs); home: the canonical link and the other scripts. Without: the web app goes to the reader's script
func (a *App) scriptShell(base, script string, home bool, path string) string {
	if script == "" {
		return base
	}
	base = htmlTagOpenRe.ReplaceAllLiteralString(base, fmt.Sprintf(`<html lang="%s" data-script="%s">`, scriptTag(script), script))
	if home {
		var head strings.Builder
		fmt.Fprintf(&head, `<link rel="canonical" href="%s/%s/">`, a.site, script)
		a.alternates(&head, "/")
		base = strings.Replace(base, "</head>", head.String()+"</head>", 1)
	}
	return base
}

// renderScriptPage: a text of the open flavor, see renderIndex for the tipitaka.lk / pitaka.lk page
func (a *App) renderScriptPage(ctx context.Context, base string, r route, node engine.Row, paths, entries []engine.Row,
	data map[string]any, p, startEntry int) ssrPage {
	withData := func(page string) string {
		return appDivRe.ReplaceAllLiteralString(page, `<div id="app"></div><script type="application/json" id="ssr-data">`+jsonStr(data)+`</script>`)
	}
	script := scriptOf(ctx)
	if script == "" {
		// /dn-1-1: the web app goes to /<the reader's script>/dn-1-1 with this data; for a crawler the page is the Roman one
		link := fmt.Sprintf(`<link rel="canonical" href="%s/latn/%s">`, a.site, r.key)
		return ssrPage{200, withData(strings.Replace(base, "</head>", link+"</head>", 1))}
	}
	name := func(row engine.Row) string { return convTo(row.Str("pali"), script) }
	href := func(key string) string { return "/" + script + "/" + key }
	tag := scriptTag(script)

	// title: "<name> < <root name>", as the web app's
	title := name(node)
	keyRoot := strings.Split(r.key, "-")[0]
	var crumbs strings.Builder
	for i := len(paths) - 1; i >= 0; i-- {
		pr := paths[i]
		if pr.Str("key") == keyRoot && keyRoot != r.key {
			title += " < " + name(pr)
		}
		fmt.Fprintf(&crumbs, `<a href="%s">%s</a>`, href(pr.Str("key")), html.EscapeString(name(pr)))
		if i > 0 {
			crumbs.WriteString(" › ")
		}
	}
	fullTitle := title + " | " + a.fl.siteName
	canonical := a.site + href(r.key) // one page per text and script (/key/<p>-<e> is the same page)

	var art strings.Builder
	art.WriteString(`<article id="ssr" lang="` + tag + `"><nav class="ssr-crumbs">` + crumbs.String() + `</nav>`)
	desc := ""
	for _, e := range entries {
		if e.Int("page_idx") == p && e.Int("entry_idx") < startEntry {
			continue
		}
		t := e.Int("p_type")
		if t < 0 || t >= len(typeNames) {
			t = 2
		}
		rc := &runConv{script: script, cap: true}
		h := MarkupToHTMLWith(e.Str("p_text"), true, rc.conv)
		// the text describes the page best: its first paragraphs, without the paragraph numbers (as tipitaka.lk's pages)
		if utf8.RuneCountInString(desc) < 120 && typeNames[t] != "heading" && typeNames[t] != "centered" {
			plain := strings.Join(strings.Fields(html.UnescapeString(htmlTagRe.ReplaceAllString(h, ""))), " ")
			if s := scriptParaNumRe.ReplaceAllLiteralString(plain, ""); s != "" {
				desc = strings.TrimSpace(desc + " " + s)
			}
		}
		fmt.Fprintf(&art, `<div class="ssr-entry %s" data-level="%d">%s</div>`, typeNames[t], e.Int("p_level"), h)
	}
	desc = cut(desc, 160)
	if desc == "" {
		desc = fmt.Sprintf("%s - the Pali Tipitaka of the Buddha Jayanti edition of Sri Lanka in %s script.", title, scriptNames[script])
	}
	next := ""
	if rows, err := a.RunNamed(ctx, "tree.neighbor", map[string]any{"id": node.Int("id"), "dir": 1}); err == nil && len(rows) > 0 && rows[0].Str("file") != "" {
		next = rows[0].Str("key")
		fmt.Fprintf(&art, `<nav class="ssr-next"><a href="%s" rel="next">Next ›</a></nav>`, href(next))
	}
	art.WriteString(`</article>`)

	var head strings.Builder
	fmt.Fprintf(&head, `<meta name="description" content="%[2]s">
<link rel="canonical" href="%[3]s">
<meta property="og:title" content="%[1]s">
<meta property="og:description" content="%[2]s">
<meta property="og:url" content="%[3]s">
<meta property="og:site_name" content="%[4]s">`, html.EscapeString(fullTitle), html.EscapeString(desc), html.EscapeString(canonical), a.fl.siteName)
	a.alternates(&head, "/"+r.key)
	if next != "" {
		fmt.Fprintf(&head, `<link rel="next" href="%s%s">`, a.site, href(next))
	}
	ld := map[string]any{"@context": "https://schema.org", "@type": "Chapter", "name": title, "description": desc, "url": canonical,
		"inLanguage": tag, "publisher": map[string]any{"@type": "Organization", "name": "Path Nirvana Foundation", "url": a.site}}
	if len(paths) > 1 {
		root := paths[len(paths)-1]
		ld["isPartOf"] = map[string]any{"@type": "Book", "name": name(root), "url": a.site + href(root.Str("key"))}
	} else {
		ld["@type"] = "Book"
	}
	fmt.Fprintf(&head, `<script type="application/ld+json">%s</script>`, jsonStr(ld))

	out := htmlTagOpenRe.ReplaceAllLiteralString(base, fmt.Sprintf(`<html lang="%s" data-script="%s">`, tag, script))
	out = titleRe.ReplaceAllLiteralString(out, "<title>"+html.EscapeString(fullTitle)+"</title>")
	out = descRe.ReplaceAllLiteralString(out, "")
	out = strings.Replace(out, "</head>", head.String()+"</head>", 1)
	out = appDivRe.ReplaceAllLiteralString(out, art.String()+`<div id="app"></div><script type="application/json" id="ssr-data">`+jsonStr(data)+`</script>`)
	return ssrPage{200, out}
}
