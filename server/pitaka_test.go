package main

import (
	"encoding/json"
	"slices"
	"strings"
	"testing"

	"tipitaka.lk/server/engine"
)

// the pitaka.lk flavor (flavor.go) on e2e/fixtures/db/pitaka-text.db (npm run build:fixture)
func newPitakaApp(t testing.TB) *App {
	t.Helper()
	a, err := NewApp(Config{Root: "../e2e/fixtures", IndexHTML: stubIndex, Flavor: "pitaka"})
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func TestPitakaSSR(t *testing.T) {
	h := newPitakaApp(t).Handler()
	body := get(t, h, "/main/dn-1-1").Body.String()
	for _, want := range []string{`<link rel="canonical" href="https://pitaka.lk/main/dn-1-1">`, `| සරල සිංහල ත්‍රිපිටකය</title>`,
		`<article id="ssr" lang="si">`, `<a href="/main/dn-1">`, `"url":"https://pitaka.lk/main/dn`, `භාග්‍යවතුන්`,
		`text.entries|{\"file\":\"dn-1\",\"from\":0,\"to\":1}`} {
		if !strings.Contains(body, want) {
			t.Errorf("ssr missing %q", want)
		}
	}
	dn1 := get(t, h, "/main/dn-1").Body.String()
	if !strings.Contains(dn1, `<a href="/main/dn-1-1" rel="next">`) || !strings.Contains(dn1, `<link rel="next" href="https://pitaka.lk/main/dn-1-1">`) {
		t.Errorf("next sutta links")
	}
	if strings.Contains(body, "hreflang") || strings.Contains(body, "බුද්ධ ජයන්ති") {
		t.Errorf("tipitaka.lk's hreflang pairs or name in a pitaka page")
	}
	// no translation: the pāḷi, described as such
	vp := get(t, h, "/main/vp-prj").Body.String()
	if !strings.Contains(vp, `<article id="ssr" lang="pi">`) || !strings.Contains(vp, `<link rel="canonical" href="https://pitaka.lk/main/vp-prj">`) {
		t.Errorf("pali only page: %s", vp)
	}
	for path, status := range map[string]int{"/main/dn-1-1/0-3": 200, "/main/": 200, "/main/settings": 200,
		"/main/dict/abc": 200, "/main/dn-1-1/pali": 404, "/main/dn-1-1/sinh": 404, "/main/atta-dn-1-1": 404,
		"/main/tipitaka-query/version": 404, "/dn-1-1": 404, "/api/dicts": 404, "/": 301, "/main": 301} {
		if rec := get(t, h, path); rec.Code != status {
			t.Errorf("%s: %d want %d", path, rec.Code, status)
		}
	}
	if loc := get(t, h, "/").Header().Get("Location"); loc != "/main/" {
		t.Errorf("/ redirects to %q", loc)
	}
}

func TestPitakaAPI(t *testing.T) {
	a := newPitakaApp(t)
	h := a.Handler()
	var rows []map[string]any
	rec := get(t, h, "/main/api/q/tree.node?key=dn-1-1")
	if err := json.Unmarshal(rec.Body.Bytes(), &rows); rec.Code != 200 || err != nil || len(rows) != 1 {
		t.Fatalf("tree.node: %d %s", rec.Code, rec.Body.String())
	}
	if a.meta["flavor"] != "pitaka" {
		t.Errorf("meta flavor %q", a.meta["flavor"])
	}
	// the five dictionaries only, also when others are asked for
	var dicts []struct{ Code string }
	json.Unmarshal(get(t, h, "/main/api/dicts").Body.Bytes(), &dicts)
	var codes []string
	for _, d := range dicts {
		codes = append(codes, d.Code)
	}
	slices.Sort(codes)
	if strings.Join(codes, " ") != "en-dppn en-ncped si-buddhadatta si-sumangala" {
		t.Errorf("dicts: %v", codes)
	}
	var dict struct {
		Entries []struct{ Dict string } `json:"entries"`
	}
	json.Unmarshal(get(t, h, "/main/api/dict?w=dhamma&dicts=en-pts,en-critical").Body.Bytes(), &dict)
	if len(dict.Entries) == 0 {
		t.Errorf("dict dhamma: no entries")
	}
	for _, e := range dict.Entries {
		if !slices.Contains(engine.PitakaDicts, e.Dict) {
			t.Errorf("dict dhamma: an entry of %s", e.Dict)
		}
	}
}

func TestPitakaSitemaps(t *testing.T) {
	h := newPitakaApp(t).Handler()
	if b := get(t, h, "/main/sitemap.xml").Body.String(); !strings.Contains(b, "<loc>https://pitaka.lk/main/sitemaps/si.xml</loc>") || strings.Contains(b, "pali.xml") {
		t.Errorf("sitemap index: %s", b)
	}
	si := get(t, h, "/main/sitemaps/si.xml").Body.String()
	for _, want := range []string{"<loc>https://pitaka.lk/main/</loc>", "<loc>https://pitaka.lk/main/dn-1-1</loc>", "<loc>https://pitaka.lk/main/vp-prj</loc>"} {
		if !strings.Contains(si, want) {
			t.Errorf("si.xml misses %s", want)
		}
	}
	if strings.Contains(si, "atta-") {
		t.Errorf("si.xml has aṭṭhakathā pages")
	}
	if rec := get(t, h, "/main/sitemaps/pali.xml"); rec.Code != 404 {
		t.Errorf("pali.xml: %d", rec.Code)
	}
}
