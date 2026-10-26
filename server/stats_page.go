package main

// /stats: the usage statistics (stats.go) by week or month - a chart of the unique visitors, tables of the last
// periods (visitors, devices, screens, countries, pages, searches, features, server calls) and the top search terms
// of a period. Behind a password (STATS_PASSWORD, any user name). (tipitaka.app, with the devices)

import (
	"crypto/subtle"
	"fmt"
	"html/template"
	"net/http"
	"sort"
	"strings"
	"time"
)

type statRow struct {
	Label string
	N     []int64 // per column
	Max   int64
}

type statTable struct {
	Title, Note string
	Rows        []statRow
}

type statTerms struct {
	Title string
	Top   []struct {
		Q string
		N int64
	}
}

type statBar struct {
	X, H, NewH, W float64
	Label         string
	N, New        int64
}

type statPage struct {
	By, Period string
	Columns    []string // the periods of the tables, oldest first
	Bars       []statBar
	Tables     []statTable
	Terms      []statTerms
}

// periods: the last n weeks (their Mondays) or months, oldest first
func periods(by string, n int, now time.Time) []string {
	now = now.UTC()
	out := make([]string, n)
	for i := 0; i < n; i++ {
		if by == "month" {
			out[n-1-i] = time.Date(now.Year(), now.Month()-time.Month(i), 1, 0, 0, 0, 0, time.UTC).Format("2006-01")
		} else {
			monday := now.AddDate(0, 0, -((int(now.Weekday())+6)%7)-7*i)
			out[n-1-i] = monday.Format("2006-01-02")
		}
	}
	return out
}

func periodExpr(by string) string {
	if by == "month" {
		return "substr(day, 1, 7)"
	}
	return "date(day, '-6 days', 'weekday 1')" // the Monday of the week
}

func periodStart(by, p string) string {
	if by == "month" {
		return p + "-01"
	}
	return p
}

var statLabels = map[string]string{
	"page:Welcome": "home", "page:Home": "texts", "page:fts": "full text search", "page:title": "title search",
	"page:dict": "dictionary search", "page:Bookmarks": "bookmarks and history", "page:Settings": "settings",
	"page:Abbreviations": "abbreviations", "page:help": "user guide", "page:names": "places and people", "page:map": "map",
	"page:NotFound": "not found",
	"api:tree.node": "sutta info", "api:tree.children": "contents tree", "api:tree.paths": "tree paths",
	"api:tree.pathsByKeys": "tree paths (bookmarks, history)", "api:tree.neighbor": "next / previous sutta",
	"api:tree.titleIndex": "title search index", "api:text.entries": "text pages", "api:text.footnotes": "footnotes",
	"api:text.align": "pali-sinhala word alignment", "api:fts.candidates": "full text search", "api:fts.count": "full text search count",
	"api:fts.texts": "full text search results", "api:fts.vocab": "singlish search words", "api:audio.entries": "recitation timings",
	"api:lookup": "word tapped in a text", "api:dict": "dictionary search", "api:dicts": "dictionary list",
	"api:links": "commentary links", "api:linkcounts": "commentary link counts", "api:glosses": "commentary glosses",
	"api:settings": "setting of a sutta", "api:names": "names index", "api:places": "map places", "api:entity": "name page",
	"api:paranames": "names in a paragraph",
	"feature:audio": "recitation played", "feature:scan": "scanned pages opened", "feature:alongside": "read with the commentary alongside",
	"feature:share": "link copied", "feature:copy": "paragraph copied", "feature:star": "star added",
	"search:fts": "full text", "search:title": "titles", "search:dict": "dictionary",
	"os:android": "Android", "os:ios": "iPhone / iPad", "os:mac": "Mac", "os:windows": "Windows", "os:linux": "Linux",
	"os:chromeos": "ChromeOS", "os:other": "other",
	"form:phone": "phone", "form:tablet": "tablet", "form:desktop": "desktop / laptop",
}

func (s *stats) handlePage(w http.ResponseWriter, r *http.Request) {
	if s.db == nil || s.password == "" {
		http.NotFound(w, r)
		return
	}
	if _, pw, ok := r.BasicAuth(); !ok || subtle.ConstantTimeCompare([]byte(pw), []byte(s.password)) != 1 {
		w.Header().Set("WWW-Authenticate", `Basic realm="tipitaka.lk stats"`)
		http.Error(w, "password needed", http.StatusUnauthorized)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	s.save() // up to now
	by := r.URL.Query().Get("by")
	if by != "month" {
		by = "week"
	}
	chartN, tableN := 52, 8
	if by == "month" {
		chartN, tableN = 24, 12
	}
	now := time.Now()
	chart := periods(by, chartN, now)
	cols := chart[chartN-tableN:]
	pg := statPage{By: by, Columns: cols, Period: r.URL.Query().Get("p")}
	if !contains(cols, pg.Period) {
		pg.Period = cols[len(cols)-1]
	}
	col := map[string]int{}
	for i, p := range cols {
		col[p] = i
	}

	// metric:value -> period -> n (without the search terms)
	data := map[string]map[string]int64{}
	rows, err := s.db.Query(`SELECT `+periodExpr(by)+` AS p, metric, value, SUM(n) FROM counts
		WHERE day >= ? AND metric NOT LIKE 'term:%' GROUP BY p, metric, value`, periodStart(by, chart[0]))
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	for rows.Next() {
		var p, metric, value string
		var n int64
		if rows.Scan(&p, &metric, &value, &n) == nil {
			k := metric + ":" + value
			if data[k] == nil {
				data[k] = map[string]int64{}
			}
			data[k][p] += n
		}
	}
	rows.Close()
	sum := func(p string, keys ...string) (n int64) {
		for _, k := range keys {
			n += data[k][p]
		}
		return n
	}
	prefixed := func(prefix string) (keys []string) {
		for k := range data {
			if strings.HasPrefix(k, prefix) {
				keys = append(keys, k)
			}
		}
		return keys
	}
	row := func(label string, f func(p string) int64) statRow {
		r := statRow{Label: label, N: make([]int64, len(cols))}
		for i, p := range cols {
			r.N[i] = f(p)
			r.Max = max(r.Max, r.N[i])
		}
		return r
	}
	users := "users:" + by

	// the chart: unique visitors, the new ones darker
	var top int64 = 1
	for _, p := range chart {
		top = max(top, data[users][p])
	}
	bw := 100.0 / float64(chartN)
	for i, p := range chart {
		u, nw := data[users][p], min(data["visit:new"][p], data[users][p])
		pg.Bars = append(pg.Bars, statBar{X: float64(i) * bw, W: bw * 0.8, H: 100 * float64(u) / float64(top),
			NewH: 100 * float64(nw) / float64(top), Label: p, N: u, New: nw})
	}

	pg.Tables = append(pg.Tables, statTable{Title: "Visitors", Note: "unique visitors of the " + by + " (counted once they tap, click or type); new: first visit ever", Rows: []statRow{
		row("unique visitors", func(p string) int64 { return data[users][p] }),
		row("new visitors", func(p string) int64 { return data["visit:new"][p] }),
		row("visits (app loads)", func(p string) int64 { return sum(p, "visit:new", "visit:returning") }),
		row("pages opened", func(p string) int64 { return sum(p, prefixed("page:")...) }),
		row("searches", func(p string) int64 { return sum(p, prefixed("search:")...) }),
		row("crawler: pages", func(p string) int64 { return data["crawler:page"][p] }),
		row("crawler: sitemaps", func(p string) int64 { return data["crawler:sitemap"][p] }),
	}})

	// countries: unique visitors
	countries := map[string][]int64{}
	crows, err := s.db.Query(`SELECT `+periodExpr(by)+` AS p, country, SUM(n) FROM counts
		WHERE day >= ? AND metric = 'users' AND value = ? GROUP BY p, country`, periodStart(by, cols[0]), by)
	if err == nil {
		for crows.Next() {
			var p, c string
			var n int64
			if crows.Scan(&p, &c, &n) == nil {
				if i, ok := col[p]; ok {
					if countries[c] == nil {
						countries[c] = make([]int64, len(cols))
					}
					countries[c][i] += n
				}
			}
		}
		crows.Close()
	}
	ct := statTable{Title: "Countries", Note: "unique visitors (DB-IP country lite)"}
	for c, ns := range countries {
		ct.Rows = append(ct.Rows, row(countryFlag(c), func(p string) int64 { return ns[col[p]] }))
	}
	sortRows(ct.Rows)
	if len(ct.Rows) > 40 {
		ct.Rows = ct.Rows[:40]
	}
	pg.Tables = append(pg.Tables, ct)

	for _, t := range []struct{ title, prefix, note string }{
		{"Devices", "os:" + by + ":", "unique visitors of the " + by + " by operating system (the website; the apps send nothing)"},
		{"Screens", "form:" + by + ":", "unique visitors of the " + by + " by the kind of device"},
		{"Pages opened", "page:", "views of the app's pages (texts: every text opened)"},
		{"Searches", "search:", "searches made (the last query of each)"},
		{"Features", "feature:", "used in the texts (without a request to the server)"},
		{"Server requests", "api:", "what the visitors' app asked the server for (repeats come from its cache)"},
	} {
		tb := statTable{Title: t.title, Note: t.note}
		for _, k := range prefixed(t.prefix) {
			value := strings.TrimPrefix(k, t.prefix)
			label := statLabels[k]
			if label == "" {
				label = statLabels[strings.SplitN(t.prefix, ":", 2)[0]+":"+value] // os:week:android -> os:android
			}
			if label == "" {
				label = value
			}
			tb.Rows = append(tb.Rows, row(label, func(p string) int64 { return data[k][p] }))
		}
		sortRows(tb.Rows)
		pg.Tables = append(pg.Tables, tb)
	}

	// the top terms of the chosen period
	start := periodStart(by, pg.Period)
	end := ""
	if i := col[pg.Period]; i+1 < len(cols) {
		end = periodStart(by, cols[i+1])
	}
	for _, t := range []struct{ title, metric string }{{"Full text searches", "term:fts"}, {"Title searches", "term:title"},
		{"Dictionary searches", "term:dict"}, {"Words tapped in texts", "term:lookup"}} {
		st := statTerms{Title: t.title}
		trows, err := s.db.Query(`SELECT value, SUM(n) AS c FROM counts WHERE metric = ? AND day >= ? AND (? = '' OR day < ?)
			GROUP BY value ORDER BY c DESC, value LIMIT 40`, t.metric, start, end, end)
		if err == nil {
			for trows.Next() {
				var e struct {
					Q string
					N int64
				}
				if trows.Scan(&e.Q, &e.N) == nil {
					st.Top = append(st.Top, e)
				}
			}
			trows.Close()
		}
		pg.Terms = append(pg.Terms, st)
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := statTemplate.Execute(w, pg); err != nil {
		fmt.Fprint(w, err)
	}
}

func contains(xs []string, x string) bool {
	for _, y := range xs {
		if y == x {
			return true
		}
	}
	return false
}

// sortRows: the largest in the latest periods first
func sortRows(rows []statRow) {
	weight := func(r statRow) (w int64) {
		for i, n := range r.N {
			w += n * int64(i+1)
		}
		return w
	}
	sort.SliceStable(rows, func(i, j int) bool { return weight(rows[i]) > weight(rows[j]) })
}

// countryFlag: the country code with its flag emoji ("" unknown)
func countryFlag(code string) string {
	if len(code) != 2 {
		return "unknown"
	}
	return string(rune(0x1F1E6+rune(code[0]-'A'))) + string(rune(0x1F1E6+rune(code[1]-'A'))) + " " + code
}

var statTemplate = template.Must(template.New("stats").Funcs(template.FuncMap{
	"sub100": func(h float64) float64 { return 100 - h },
	"shade": func(n, max int64) string {
		if max == 0 {
			return "0"
		}
		return fmt.Sprintf("%.2f", 0.08+0.5*float64(n)/float64(max))
	},
	"short": func(p string) string {
		if len(p) == 10 {
			t, _ := time.Parse("2006-01-02", p)
			return t.Format("Jan 2")
		}
		t, _ := time.Parse("2006-01", p)
		return t.Format("Jan 2006")
	},
}).Parse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Tipitaka.lk statistics</title>
<style>
:root { --bg: #fbf8f3; --fg: #2b2522; --muted: #7a6f66; --line: #e6ddd2; --bar: #c9a88a; --bar2: #8a4b22; --cell: 138 75 34; }
@media (prefers-color-scheme: dark) { :root { --bg: #1d1a18; --fg: #ece5dd; --muted: #a69c92; --line: #3a332d; --bar: #6e5440; --bar2: #e0965f; --cell: 224 150 95; } }
body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.45 system-ui, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 16px; }
h1 { font-size: 20px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 28px 0 2px; }
.note { color: var(--muted); font-size: 12px; margin: 0 0 6px; }
nav a { margin-right: 12px; color: var(--bar2); } nav a.on { font-weight: 700; text-decoration: none; color: var(--fg); }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { padding: 3px 8px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; }
th:first-child, td:first-child { text-align: left; }
th a { color: inherit; } th.on { text-decoration: underline; }
svg { width: 100%; height: 140px; display: block; }
.terms { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.terms ol { margin: 0; padding-left: 22px; } .terms li span { color: var(--muted); }
footer { margin: 32px 0 8px; color: var(--muted); font-size: 12px; } footer a { color: inherit; }
</style></head><body><main>
<h1>Tipitaka.lk statistics</h1>
<nav><a href="?by=week" {{if eq .By "week"}}class="on"{{end}}>by week</a><a href="?by=month" {{if eq .By "month"}}class="on"{{end}}>by month</a></nav>
<p class="note">the last column is this {{.By}} so far (days in UTC)</p>

<h2>Unique visitors</h2><p class="note">per {{.By}}, the new visitors darker</p>
<svg viewBox="0 0 100 100" preserveAspectRatio="none">{{range .Bars}}<rect x="{{.X}}" y="{{printf "%.2f" (sub100 .H)}}" width="{{.W}}" height="{{.H}}" fill="var(--bar)"><title>{{short .Label}}: {{.N}} ({{.New}} new)</title></rect><rect x="{{.X}}" y="{{printf "%.2f" (sub100 .NewH)}}" width="{{.W}}" height="{{.NewH}}" fill="var(--bar2)"><title>{{short .Label}}: {{.N}} ({{.New}} new)</title></rect>{{end}}</svg>

{{$by := .By}}{{$cols := .Columns}}{{$period := .Period}}
{{range .Tables}}<h2>{{.Title}}</h2><p class="note">{{.Note}}</p><div class="scroll"><table>
<tr><th></th>{{range $cols}}<th {{if eq . $period}}class="on"{{end}}><a href="?by={{$by}}&p={{.}}">{{short .}}</a></th>{{end}}</tr>
{{range .Rows}}{{$max := .Max}}<tr><td>{{.Label}}</td>{{range .N}}<td style="background: rgb(var(--cell) / {{shade . $max}})">{{.}}</td>{{end}}</tr>{{end}}
</table></div>{{end}}

<h2>Top search terms – {{short .Period}}</h2><p class="note">choose another {{.By}} with the column headers above</p>
<div class="terms">{{range .Terms}}<div><h3>{{.Title}}</h3>{{if .Top}}<ol>{{range .Top}}<li>{{.Q}} <span>{{.N}}</span></li>{{end}}</ol>{{else}}<p class="note">none</p>{{end}}</div>{{end}}</div>

<footer>Anonymous counts only: no addresses or visitor ids are stored. Countries: <a href="https://db-ip.com">IP Geolocation by DB-IP</a> (CC BY 4.0).</footer>
</main></body></html>`))
