package main

import (
	"regexp"
	"strings"
	"testing"
)

// the open.tipitaka.lk flavor (flavor.go) on e2e/fixtures/db/text.db: tipitaka.lk's db, the pages under /<script>/
func TestOpenFlavor(t *testing.T) {
	a, err := NewApp(Config{Root: "../e2e/fixtures", IndexHTML: stubIndex, Flavor: "open"})
	if err != nil {
		t.Fatal(err)
	}
	h := a.Handler()
	for path, want := range map[string]int{"/": 200, "/latn": 200, "/latn/": 200, "/thai/dn-1-1": 200, "/dn-1-1": 200,
		"/latn/no-such-key": 404, "/latn/missing.js": 404, "/tipitaka-query/version": 404, "/api/health": 200} {
		if rec := get(t, h, path); rec.Code != want {
			t.Errorf("%s: status %d, want %d", path, rec.Code, want)
		}
	}
	// a text: the article in the script of the url, with the reader's data
	body := get(t, h, "/latn/dn-1-1").Body.String()
	for _, want := range []string{`<html lang="pi-Latn" data-script="latn"`, `<article id="ssr" lang="pi-Latn">`, `id="ssr-data"`,
		`<title>Brahmajālasuttaṃ &lt; Dīghanikāya | Buddha Jayanti Tipitaka</title>`,
		// Roman capitals: the start of the paragraph and of a sentence, not a bold word in a sentence (as the web app)
		`1. Evaṃ me sutaṃ ekaṃ samayaṃ bhagavā antarā ca <b>rājagahaṃ</b> antarā ca <b>nālandaṃ</b>`, `bhikkhusatehi. <b>Suppiyo</b>’pi kho`,
		`<link rel="canonical" href="https://open.tipitaka.lk/latn/dn-1-1">`,
		`<link rel="alternate" hreflang="pi-Thai" href="https://open.tipitaka.lk/thai/dn-1-1">`,
		`<link rel="alternate" hreflang="x-default" href="https://open.tipitaka.lk/latn/dn-1-1">`,
		`<a href="/latn/dn">Dīghanikāya</a>`, `"inLanguage":"pi-Latn"`} {
		if !strings.Contains(body, want) {
			t.Errorf("/latn/dn-1-1: no %s", want)
		}
	}
	article := body[strings.Index(body, "<article"):strings.Index(body, "</article>")]
	if sinhalaRe.MatchString(article) || strings.Contains(body, "tipitaka.lk/dn-1-1/") {
		t.Errorf("Sinhala letters or tipitaka.lk's links in the Roman page")
	}
	// the pāḷi alone: no Sinhala names, translation or aṭṭhakathā links in the data
	for _, not := range []string{`"s_text":"`, `"sinh":"`, `"mirror_key":"a`} {
		if i := strings.Index(body, not); i >= 0 && body[i+len(not)] != '"' && not != `"mirror_key":"a` || not == `"mirror_key":"a` && i >= 0 {
			t.Errorf("/latn/dn-1-1: %s in the data", not)
		}
	}
	if deva := get(t, h, "/deva/dn-1-1").Body.String(); !strings.Contains(deva, "एवं मे सुतं") || !strings.Contains(deva, `<html lang="pi-Deva" data-script="deva"`) {
		t.Errorf("/deva/dn-1-1 is not in Devanagari")
	}
	if sinh := get(t, h, "/sinh/dn-1-1").Body.String(); !strings.Contains(sinh, "එවං මෙ සුතං") {
		t.Errorf("/sinh/dn-1-1 is not in Sinhala script")
	}
	// no script: the reader's data and the Roman page as canonical, no article
	if bare := get(t, h, "/dn-1-1").Body.String(); strings.Contains(bare, "<article") || !strings.Contains(bare, `rel="canonical" href="https://open.tipitaka.lk/latn/dn-1-1"`) {
		t.Errorf("/dn-1-1: an article or no canonical link")
	}
	if home := get(t, h, "/thai/").Body.String(); !strings.Contains(home, `rel="canonical" href="https://open.tipitaka.lk/thai/"`) || !strings.Contains(home, `data-script="thai"`) {
		t.Errorf("/thai/: no canonical link or script")
	}
	// the aṭṭhakathā are not on this site: pages, tree, title index, texts
	if rec := get(t, h, "/latn/atta-dn-1-1"); rec.Code != 404 {
		t.Errorf("/latn/atta-dn-1-1: status %d", rec.Code)
	}
	for _, q := range []string{"/api/q/tree.children?parent_id=0", "/api/q/tree.titleIndex", "/api/q/text.entries?file=atta-dn-1&from=0&to=1", "/api/q/tree.node?key=atta-dn-1-1"} {
		if b := get(t, h, q).Body.String(); strings.Contains(b, `"atta-`) || strings.Contains(b, `"anya`) || sinhalaRe.MatchString(strings.ReplaceAll(b, `"pali":`, "")) && strings.Contains(b, `"sinh":"ස`) {
			t.Errorf("%s: aṭṭhakathā or Sinhala names in the open flavor: %.200s", q, b)
		}
	}
	if b := get(t, h, "/api/q/tree.children?parent_id=0").Body.String(); !strings.Contains(b, `"key":"vp"`) {
		t.Errorf("tree.children: no vinaya: %.200s", b)
	}
	// a sitemap per script
	if idx := get(t, h, "/sitemap.xml").Body.String(); !strings.Contains(idx, "/sitemaps/latn.xml") || !strings.Contains(idx, "/sitemaps/thai.xml") || strings.Contains(idx, "pali.xml") {
		t.Errorf("sitemap index: %.300s", idx)
	}
	if sm := get(t, h, "/sitemaps/thai.xml").Body.String(); !strings.Contains(sm, "<loc>https://open.tipitaka.lk/thai/dn-1-1</loc>") || strings.Contains(sm, "/thai/atta-") {
		t.Errorf("thai sitemap: %.300s", sm)
	}
	if rec := get(t, h, "/sitemaps/bali.xml"); rec.Code != 404 {
		t.Errorf("/sitemaps/bali.xml: status %d", rec.Code)
	}
}

var sinhalaRe = regexp.MustCompile(`[\x{0D80}-\x{0DFF}]`)

// the urls of the old open.tipitaka.lk (old_open.go)
func TestOldOpenURLs(t *testing.T) {
	a, err := NewApp(Config{Root: "../e2e/fixtures", IndexHTML: stubIndex, Flavor: "open"})
	if err != nil {
		t.Fatal(err)
	}
	h := a.Handler()
	for path, want := range map[string]string{
		"/latn/dn-1-1/full":        "/latn/dn-1-1",
		"/deva/book/10":            "/deva/dn-1",
		"/sin_apz/dn-1-1":          "https://pitaka.lk/main/dn-1-1",
		"/latn+sin_apz/dn-1-1/4-1": "https://pitaka.lk/main/dn-1-1",
		"/sin_sarala_ai/vp-prj":    "https://pitaka.lk/main/vp-prj",
		"/sin_apz/book/10":         "https://pitaka.lk/main/dn-1",
		"/sin_apz":                 "https://pitaka.lk/main/",
		"/sin_bjt/dn-1-1":          "https://tipitaka.lk/dn-1-1/sinh",
		"/sinh+sin_bjt/dn-1-1":     "https://tipitaka.lk/dn-1-1",
		"/sin_bjt":                 "https://tipitaka.lk/",
		"/latn+thai/dn-1-1":        "/latn/dn-1-1",
		"/latn+thai":               "/latn/",
		"/latn/kn-ps-1-1-16":       "/latn/kn-ps-1-1-17",
		"/help/about":              "/",
	} {
		rec := get(t, h, path)
		if got := rec.Header().Get("Location"); rec.Code != 301 || got != want {
			t.Errorf("%s: %d %q, want 301 %q", path, rec.Code, got, want)
		}
	}
	// urls of this site
	for _, path := range []string{"/latn/", "/latn/dn-1-1", "/latn/dn-1-1/1-1", "/latn/dn-1-1/4-1", "/dn-1-1", "/latn/search/12-3", "/latn/search/x/1-0-10",
		"/latn/titles/brahma", "/latn/bookmarks", "/search/x", "/api/health", "/sitemap.xml"} {
		if rec := get(t, h, path); rec.Code != 200 {
			t.Errorf("%s: %d %s", path, rec.Code, rec.Header().Get("Location"))
		}
	}
	// not redirected: the old collections pali and eng_thani
	for _, path := range []string{"/pali/dn-1-1", "/eng_thani/dn-1-1", "/pali+eng_thani/dn-1-1"} {
		if rec := get(t, h, path); rec.Code == 301 {
			t.Errorf("%s: redirected to %s", path, rec.Header().Get("Location"))
		}
	}
}
