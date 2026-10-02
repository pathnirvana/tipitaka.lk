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
	if rec.Body.String() != APPNAME || rec.Header().Get("Access-Control-Allow-Origin") != "*" {
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
