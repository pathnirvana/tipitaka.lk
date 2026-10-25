package main

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"
)

const stubIndex = `<!doctype html><html><head><title>Tripitaka</title><meta name="description" content="x"></head><body><div id="app"></div></body></html>`

func newTestApp(t testing.TB, root string) *App {
	t.Helper()
	a, err := NewApp(Config{Root: root, IndexHTML: stubIndex})
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func get(t testing.TB, h http.Handler, target string, hdr ...string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", target, nil)
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestQueriesSamples(t *testing.T) {
	a := newTestApp(t, "../e2e/fixtures")
	b, err := os.ReadFile("queries.samples.json")
	if err != nil {
		t.Fatal(err)
	}
	samples := map[string][]map[string]any{}
	json.Unmarshal(b, &samples)
	for name := range a.queries {
		if len(samples[name]) == 0 {
			t.Errorf("no samples for %s", name)
		}
		for _, params := range samples[name] {
			rows, err := a.RunNamed(context.Background(), name, params)
			if err != nil || len(rows) == 0 {
				t.Errorf("%s %v: rows=%d err=%v", name, params, len(rows), err)
			}
			for _, r := range rows {
				for i, v := range r.vals {
					if v == nil {
						t.Errorf("%s: NULL in column %s", name, r.cols[i])
					}
				}
			}
		}
	}
}

func TestMarkupGolden(t *testing.T) {
	b, err := os.ReadFile("../shared/markup-cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct{ Input, HTML string }
	json.Unmarshal(b, &cases)
	if len(cases) < 40 {
		t.Fatal("too few cases")
	}
	for _, c := range cases {
		if got := MarkupToHTML(c.Input, false); got != c.HTML {
			t.Errorf("markup %q\n got %q\nwant %q", c.Input, got, c.HTML)
		}
	}
}

func TestReadOnly(t *testing.T) {
	a := newTestApp(t, "../e2e/fixtures")
	if _, err := a.dbs.Text.Exec("CREATE TABLE x(a)"); err == nil {
		t.Fatal("text.db is writable")
	}
	if _, err := a.dbs.Dict.Exec("DELETE FROM dictionary"); err == nil {
		t.Fatal("dict.db is writable")
	}
}

func TestTimeout(t *testing.T) {
	a := newTestApp(t, "../e2e/fixtures")
	a.queries["test.slow"] = &NamedQuery{Name: "test.slow", DB: "text", Params: map[string]string{}, MaxRows: 1,
		SQL: "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c) SELECT count(*) FROM c"}
	start := time.Now()
	rec := get(t, a.Handler(), "/api/q/test.slow")
	if rec.Code != 503 || time.Since(start) > 10*time.Second {
		t.Fatalf("expected 503 after the timeout, got %d after %v", rec.Code, time.Since(start))
	}
}

func TestAPI(t *testing.T) {
	a := newTestApp(t, "../e2e/fixtures")
	h := a.Handler()
	cases := []struct {
		target string
		status int
	}{
		{"/api/q/nope", 404},
		{"/api/q/tree.node", 400},
		{"/api/q/text.entries?file=dn-1&from=x&to=1", 400},
		{"/api/q/text.entries?file=dn-1&from=0&to=99999999999", 400},
		{"/api/q/fts.candidates?" + url.Values{"q": {`"unbalanced`}, "lang": {"2"}, "groups": {""}, "limit": {"10"}}.Encode(), 400},
		{"/api/q/tree.node?key=dn-1-1", 200},
		{"/sql-query", 404},
		{"/api/health", 200},
	}
	for _, c := range cases {
		if rec := get(t, h, c.target); rec.Code != c.status {
			t.Errorf("%s: got %d want %d (%s)", c.target, rec.Code, c.status, rec.Body.String())
		}
	}
	rec := get(t, h, "/api/q/fts.candidates?"+url.Values{"q": {`"unbalanced`}, "lang": {"2"}, "groups": {""}, "limit": {"10"}}.Encode())
	if !strings.Contains(rec.Body.String(), "fts_syntax") {
		t.Errorf("expected fts_syntax error, got %s", rec.Body.String())
	}
	// post with json body
	req := httptest.NewRequest("POST", "/api/q/tree.node", strings.NewReader(`{"key":"dn-1-1"}`))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	var rows []map[string]any
	json.Unmarshal(rr.Body.Bytes(), &rows)
	if rr.Code != 200 || len(rows) != 1 || rows[0]["file"] != "dn-1" {
		t.Errorf("post: %d %s", rr.Code, rr.Body.String())
	}
	// caching
	rec = get(t, h, "/api/q/tree.node?key=dn-1-1")
	if rec.Header().Get("Cache-Control") != "no-cache" || rec.Header().Get("ETag") == "" {
		t.Errorf("bad cache headers %v", rec.Header())
	}
	rec = get(t, h, "/api/q/tree.node?key=dn-1-1&v="+a.apiHash)
	if !strings.Contains(rec.Header().Get("Cache-Control"), "immutable") {
		t.Errorf("expected immutable %v", rec.Header())
	}
	rec = get(t, h, "/api/q/tree.node?key=dn-1-1", "If-None-Match", `W/"`+a.apiHash+`"`)
	if rec.Code != 304 {
		t.Errorf("expected 304 got %d", rec.Code)
	}
	// gzip
	rec = get(t, h, "/api/q/text.entries?file=dn-1&from=0&to=3", "Accept-Encoding", "gzip")
	if rec.Header().Get("Content-Encoding") != "gzip" {
		t.Fatalf("expected gzip %v", rec.Header())
	}
	zr, _ := gzip.NewReader(rec.Body)
	body, _ := io.ReadAll(zr)
	if !strings.Contains(string(body), `"p_text"`) {
		t.Errorf("bad gzip body")
	}
}

func TestLegacyEndpoints(t *testing.T) {
	h := newTestApp(t, "../e2e/fixtures").Handler()
	rec := get(t, h, "/tipitaka-query/version")
	if rec.Body.String() != "Tipitaka.lk v"+PublishedVersion || rec.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Errorf("version: %q %v", rec.Body.String(), rec.Header())
	}
	if rec := get(t, h, "/tipitaka-query/bjt-params"); rec.Code != 200 {
		t.Errorf("bjt-params %d", rec.Code)
	}
}

func TestBjtScans(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(dir+"/10", 0o755)
	os.WriteFile(dir+"/10/DN1_Page_001.jpg", []byte("jpg"), 0o644)
	a, err := NewApp(Config{Root: "../e2e/fixtures", IndexHTML: stubIndex, BjtPath: dir})
	if err != nil {
		t.Fatal(err)
	}
	h := a.Handler()
	if rec := get(t, h, "/tipitaka-query/bjt-params"); rec.Body.String() != "/bjt-scanned-pages|jpg" {
		t.Errorf("bjt params %q", rec.Body.String())
	}
	if rec := get(t, h, "/bjt-scanned-pages/10/DN1_Page_001.jpg"); rec.Body.String() != "jpg" {
		t.Errorf("scan not served")
	}
}

func TestSSR(t *testing.T) {
	h := newTestApp(t, "../e2e/fixtures").Handler()
	rec := get(t, h, "/dn-1-1/sinh")
	body := rec.Body.String()
	for _, want := range []string{`<article id="ssr"`, `id="ssr-data"`, `<link rel="canonical" href="https://tipitaka.lk/dn-1-1/sinh">`,
		`බ්‍රහ්මජාල`, `| බුද්ධ ජයන්ති ත්‍රිපිටකය</title>`, `tipitaka-api`, `text.entries|{\"file\":\"dn-1\",\"from\":0,\"to\":1}`} {
		if !strings.Contains(body, want) {
			t.Errorf("ssr missing %q", want)
		}
	}
	if strings.Contains(body, `content="x"`) {
		t.Errorf("old description not replaced")
	}
	if strings.Count(body, "<script") != strings.Count(body, "</script>") {
		t.Errorf("unbalanced script tags")
	}
	// one canonical page per sutta and language, hreflang pali / sinhala, a description from the text, rel=next
	for _, want := range []string{`<link rel="alternate" hreflang="pi" href="https://tipitaka.lk/dn-1-1/pali">`,
		`<link rel="alternate" hreflang="si" href="https://tipitaka.lk/dn-1-1/sinh">`, `"@type":"Chapter"`, `"isPartOf"`,
		`<article id="ssr" lang="si">`} {
		if !strings.Contains(body, want) {
			t.Errorf("ssr missing %q", want)
		}
	}
	if !strings.Contains(get(t, h, "/dn-1/pali").Body.String(), `<link rel="next" href="https://tipitaka.lk/dn-1-1/pali">`) {
		t.Errorf("rel=next to the next sutta missing")
	}
	if !regexp.MustCompile(`<meta name="description" content="[^"]*භාග්‍යවතුන්`).MatchString(body) {
		t.Errorf("description is not taken from the text")
	}
	for path, canonical := range map[string]string{"/dn-1-1": "/dn-1-1/pali", "/dn-1-1/0-3/sinh": "/dn-1-1/sinh", "/ap-pat/sinh": "/ap-pat/pali"} {
		if !strings.Contains(get(t, h, path).Body.String(), `<link rel="canonical" href="https://tipitaka.lk`+canonical+`">`) {
			t.Errorf("%s: canonical should be %s", path, canonical)
		}
	}
	for path, status := range map[string]int{"/ap-pat/sinh": 200, "/ap-pat-1/0-3/sinh": 200, "/dn-1-1/9999-0/pali": 200,
		"/nosuchkey/pali": 404, "/settings": 200, "/fts/ධම්ම/0-0-10": 200, "/dict/abc": 200, "/": 200, "/dn-1-1/x/pali": 404,
		"/missing.js": 404, "/atta-dn-1-1/pali": 200} {
		if rec := get(t, h, path); rec.Code != status {
			t.Errorf("%s: %d want %d", path, rec.Code, status)
		}
	}
}

// SSR must never fail for any tree key / language / position
func TestSSRAllKeys(t *testing.T) {
	root := "../e2e/fixtures"
	if os.Getenv("FULL") != "" {
		root = ".."
	}
	a := newTestApp(t, root)
	h := a.Handler()
	rows, err := a.RunNamed(context.Background(), "tree.titleIndex", map[string]any{})
	if err != nil {
		t.Fatal(err)
	}
	for _, r := range rows {
		for _, suffix := range []string{"/pali", "/sinh", "/0-0/sinh", "/1-9999/pali", ""} {
			path := "/" + r.Str("key") + suffix
			if rec := get(t, h, path); rec.Code != 200 || !strings.Contains(rec.Body.String(), `id="ssr"`) {
				t.Fatalf("%s: %d", path, rec.Code)
			}
		}
	}
	t.Logf("rendered %d keys", len(rows))
}

func FuzzSSRPath(f *testing.F) {
	a := newTestApp(f, "../e2e/fixtures")
	h := a.Handler()
	for _, s := range []string{"/dn-1-1/sinh", "/ap-pat/0-0/sinh", "/x/1-2/pali", "/dn-1/99999999999-1/sinh", "//", "/dn-1-1/-1-0/pali"} {
		f.Add(s)
	}
	f.Fuzz(func(t *testing.T, p string) {
		u, err := url.Parse(p)
		if err != nil || !strings.HasPrefix(u.Path, "/") {
			return
		}
		req := &http.Request{Method: "GET", URL: u, Header: http.Header{}}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req.WithContext(context.Background()))
		if rec.Code >= 500 {
			t.Fatalf("%q -> %d", p, rec.Code)
		}
	})
}

func TestLatestVersion(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("Tipitaka.lk v3.1")) }))
	defer upstream.Close()
	LatestVersionURL = upstream.URL
	h := newTestApp(t, "../e2e/fixtures").Handler()
	if rec := get(t, h, "/tipitaka-query/latest-version"); rec.Body.String() != "Tipitaka.lk v3.1" {
		t.Errorf("latest version %d %q", rec.Code, rec.Body.String())
	}
	req := httptest.NewRequest("GET", "/tipitaka-query/latest-version", nil)
	req.Host = "tipitaka.lk"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Body.String() != "Tipitaka.lk v"+PublishedVersion {
		t.Errorf("on tipitaka.lk expected own version, got %q", rec.Body.String())
	}
}

func TestRobotsSitemaps(t *testing.T) {
	h := newTestApp(t, "../e2e/fixtures").Handler()
	if b := get(t, h, "/robots.txt").Body.String(); !strings.Contains(b, "Sitemap: https://tipitaka.lk/sitemap.xml") || !strings.Contains(b, "Disallow: /api/") {
		t.Errorf("robots.txt: %s", b)
	}
	if b := get(t, h, "/sitemap.xml").Body.String(); !strings.Contains(b, "<loc>https://tipitaka.lk/sitemaps/sinh.xml</loc>") {
		t.Errorf("sitemap index: %s", b)
	}
	pali, sinh := get(t, h, "/sitemaps/pali.xml").Body.String(), get(t, h, "/sitemaps/sinh.xml").Body.String()
	if !strings.Contains(pali, "<loc>https://tipitaka.lk/dn-1-1/pali</loc>") || !strings.Contains(sinh, "<loc>https://tipitaka.lk/dn-1-1/sinh</loc>") {
		t.Errorf("sitemaps miss dn-1-1")
	}
	if !strings.Contains(pali, "/ap-pat/pali<") || strings.Contains(sinh, "/ap-pat/sinh<") {
		t.Errorf("pali only files are in the pali sitemap only")
	}
	if rec := get(t, h, "/sitemaps/x.xml"); rec.Code != 404 {
		t.Errorf("unknown sitemap: %d", rec.Code)
	}
	if rec := get(t, h, "/dn-1-1/pali"); rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Errorf("security headers missing")
	}
}

// rendered pages are cached; when no render slot is free a person gets the app shell, a crawler 503
func TestSSRGuard(t *testing.T) {
	a := newTestApp(t, "../e2e/fixtures")
	h := a.Handler()
	get(t, h, "/dn-1-1/pali")
	get(t, h, "/dn-1-1/pali")
	if a.guard.stats.cacheHits.Load() != 1 {
		t.Errorf("second request not from the cache")
	}
	for i := 0; i < ssrSlots; i++ {
		a.guard.ssr.acquire(context.Background(), 0)
	}
	defer func() {
		for i := 0; i < ssrSlots; i++ {
			a.guard.ssr.release()
		}
	}()
	ua := func(agent string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("GET", "/dn-1/sinh", nil)
		req.Header.Set("User-Agent", agent)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}
	if rec := ua("Mozilla/5.0 (Linux; Android 10) Chrome/120.0 Mobile Safari/537.36"); rec.Code != 200 || strings.Contains(rec.Body.String(), `id="ssr"`) {
		t.Errorf("busy: a person gets the app shell (%d)", rec.Code)
	}
	if rec := ua("Mozilla/5.0 (compatible; Googlebot/2.1)"); rec.Code != 503 || rec.Header().Get("Retry-After") == "" {
		t.Errorf("busy: a crawler gets 503 + Retry-After (%d)", rec.Code)
	}
}

// the dictionary ops of the engine (tipitaka.app dict.go): a clicked word (DPD analysis + dictionaries), a typed word,
// the list of dictionaries; responses are immutable with ?v=<api_hash>
func TestDictOps(t *testing.T) {
	a := newTestApp(t, "../e2e/fixtures")
	h := a.Handler()
	var look struct {
		Word    string                        `json:"word"`
		Dpd     []struct{ Lemma string }      `json:"dpd"`
		Entries []struct{ Dict, Word string } `json:"entries"`
		Grammar json.RawMessage               `json:"grammar"`
	}
	rec := get(t, h, "/api/lookup?w=dhammaṃ&v="+a.apiHash)
	if err := json.Unmarshal(rec.Body.Bytes(), &look); err != nil || rec.Code != 200 {
		t.Fatalf("lookup: %d %s", rec.Code, rec.Body.String())
	}
	if len(look.Dpd) == 0 || !strings.HasPrefix(look.Dpd[0].Lemma, "dhamma") || len(look.Grammar) == 0 || len(look.Entries) == 0 {
		t.Errorf("lookup dhammaṃ: %+v", look)
	}
	if cc := rec.Header().Get("Cache-Control"); !strings.Contains(cc, "immutable") {
		t.Errorf("lookup with ?v=api_hash: %q", cc)
	}
	var dict struct {
		Entries []struct{ Dict, Word string } `json:"entries"`
		Dpd     []struct{ Lemma string }      `json:"dpd"`
	}
	json.Unmarshal(get(t, h, "/api/dict?w=dhamma&dicts=si-sumangala,en-pts").Body.Bytes(), &dict)
	if len(dict.Entries) == 0 || len(dict.Dpd) != 0 {
		t.Errorf("dict dhamma in two dictionaries (no dpd): %+v", dict)
	}
	for _, e := range dict.Entries {
		if e.Dict != "si-sumangala" && e.Dict != "en-pts" {
			t.Errorf("entry of an unselected dictionary: %s", e.Dict)
		}
	}
	var dicts []struct{ Code, Lang string }
	json.Unmarshal(get(t, h, "/api/dicts").Body.Bytes(), &dicts)
	if len(dicts) != 8 || dicts[len(dicts)-1].Lang != "si" {
		t.Errorf("dicts: %+v", dicts)
	}
	if rec := get(t, h, "/api/nosuchop"); rec.Code != 404 {
		t.Errorf("unknown op: %d", rec.Code)
	}
}

func TestNamesOps(t *testing.T) {
	a := newTestApp(t, "../e2e/fixtures")
	h := a.Handler()
	decode := func(target string, v any) {
		t.Helper()
		rec := get(t, h, target)
		if rec.Code != 200 {
			t.Fatalf("%s: %d %s", target, rec.Code, rec.Body.String())
		}
		if err := json.Unmarshal(rec.Body.Bytes(), v); err != nil {
			t.Fatalf("%s: %v", target, err)
		}
	}
	// mūla -> aṭṭhakathā and back
	var links []struct {
		Key, File   string
		Page, Entry int
	}
	decode("/api/links?file=dn-1&page=1&entry=0", &links)
	if len(links) == 0 || !strings.HasPrefix(links[0].File, "atta-") {
		t.Fatalf("links of dn-1 1:0: %+v", links)
	}
	var back []struct {
		File        string
		Page, Entry int
	}
	decode("/api/links?file="+links[0].File+"&page="+strconv.Itoa(links[0].Page)+"&entry="+strconv.Itoa(links[0].Entry), &back)
	found := false
	for _, b := range back {
		found = found || (b.File == "dn-1" && b.Page == 1 && b.Entry == 0)
	}
	if !found {
		t.Errorf("atta -> mūla does not lead back: %+v", back)
	}
	var counts map[string]int
	decode("/api/linkcounts?file=dn-1&from=0&to=2", &counts)
	if counts["1:0"] < len(links) {
		t.Errorf("linkcounts 1:0 = %d, links %d", counts["1:0"], len(links))
	}
	// glosses: the mūla words a commentary lemma quotes, from both sides
	type gloss struct {
		G, P, E, W, EP, EE, EW, TP, TE, TW, TEP, TEE, TEW, XP, XE, XW int
		Side, File, Key                                               string
	}
	var gs []gloss
	decode("/api/glosses?file=dn-1&from=0&to=1", &gs)
	if len(gs) == 0 {
		t.Fatal("no glosses on dn-1 pages 0-1")
	}
	before := func(p1, e1, w1, p2, e2, w2 int) bool {
		return p1 < p2 || (p1 == p2 && (e1 < e2 || (e1 == e2 && w1 <= w2)))
	}
	for _, g := range gs {
		if g.Side != "t" || g.File != "atta-dn-1" || !strings.HasPrefix(g.Key, "atta-dn-1") || !before(g.P, g.E, g.W, g.EP, g.EE, g.EW) ||
			!before(g.TP, g.TE, g.TW, g.TEP, g.TEE, g.TEW) || !before(g.TEP, g.TEE, g.TEW, g.XP, g.XE, g.XW) {
			t.Fatalf("gloss from dn-1: %+v", g)
		}
	}
	var cs []gloss
	decode("/api/glosses?file=atta-dn-1&from="+strconv.Itoa(gs[0].TP)+"&to="+strconv.Itoa(gs[0].TP), &cs)
	found = false
	for _, c := range cs {
		found = found || (c.G == gs[0].G && c.Side == "c" && c.File == "dn-1" && c.P == gs[0].TP && c.TP == gs[0].P && c.TW == gs[0].W)
	}
	if !found {
		t.Errorf("gloss %d not seen from atta-dn-1: %+v", gs[0].G, cs)
	}
	// the setting of a sutta: its own, then a sub-node's from the parent
	var set struct {
		From  string                        `json:"from"`
		Roles []struct{ Slug, Role string } `json:"roles"`
	}
	decode("/api/settings?key=dn-1-1", &set)
	slugs := ""
	for _, r := range set.Roles {
		slugs += r.Role + ":" + r.Slug + " "
	}
	if set.From != "" || !strings.Contains(slugs, "place:rajagaha") {
		t.Errorf("settings dn-1-1: %+v", set)
	}
	// names, places, an entity's page
	var names []struct{ Slug string }
	decode("/api/names?q=savatth&limit=5", &names)
	if len(names) == 0 || names[0].Slug != "savatthi" {
		t.Errorf("names savatth: %+v", names)
	}
	var places []struct {
		Slug string
		Prec int
	}
	decode("/api/places", &places)
	if len(places) == 0 || places[0].Prec == 0 {
		t.Errorf("places: %+v", places)
	}
	var page struct {
		Slug     string
		Settings []struct{ Key, Role, ParentPali string } `json:"settingNodes"`
		Mentions []struct {
			Key   string
			Count int
		} `json:"mentionNodes"`
	}
	decode("/api/entity?slug=rajagaha", &page)
	if page.Slug != "rajagaha" || len(page.Settings) == 0 || page.Settings[0].ParentPali == "" {
		t.Errorf("entity rajagaha: %+v", page)
	}
	if rec := get(t, h, "/api/entity?slug=no-such-name"); rec.Code != 404 {
		t.Errorf("unknown entity: %d", rec.Code)
	}
}
