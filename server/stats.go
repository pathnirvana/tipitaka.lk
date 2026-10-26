package main

// Usage statistics of the website (tipitaka.app's, plus the visitors' devices): anonymous daily counts, nothing
// about a single visitor.
//   - the web app sends beacons (web/src/composables/stats.ts), only once the visitor taps, clicks or types (crawlers
//     that run the app never do): whether the visitor is new and whether this is their first visit of the day / week /
//     month (so the unique visitors of a week are a sum), with their device (operating system and phone / tablet /
//     desktop); when the page is hidden the pages opened, the searches made (the last query of each), the app's
//     requests to the server (named queries and engine ops), the features used without a request (recitation, scans,
//     reading alongside) and the words tapped in texts;
//   - the server counts the requests of crawlers;
//   - the country comes from the address (geo.go); the address itself is not kept.
// Counts are rows (day, metric, value, country, n) of a sqlite db (-metrics), saved every minute and on exit.
// /stats shows them by week or month (stats_page.go). The Android / iOS / desktop apps send nothing.

import (
	"database/sql"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
	"unicode/utf8"

	_ "github.com/mattn/go-sqlite3"
	"tipitaka.lk/server/engine"
)

const maxKeys = 50000 // distinct counts kept between two saves (a flood of made up search terms is dropped)

type countKey struct{ day, metric, value, country string }

type stats struct {
	geo      atomic.Pointer[geoDB]
	db       *sql.DB // nil: no counting (the desktop app, tests)
	password string  // of /stats (STATS_PASSWORD; empty: no /stats)
	mu       sync.Mutex
	counts   map[countKey]int64
	apis     map[string]bool // the named queries and engine ops the web app may report
}

func newStats(queries map[string]*engine.NamedQuery) *stats {
	s := &stats{counts: map[countKey]int64{}, apis: map[string]bool{}}
	for name := range queries {
		s.apis[name] = name != "meta.info"
	}
	for _, op := range engine.Ops {
		s.apis[op] = op != "meta"
	}
	return s
}

// start opens the metrics db and loads the country db (in the background: the server answers meanwhile).
func (s *stats) start(metrics, geo, password string) error {
	s.password = password
	if geo != "" {
		go func() {
			t := time.Now()
			g, err := loadGeo(geo)
			if err != nil {
				log.Printf("geoip: %v", err)
				return
			}
			s.geo.Store(g)
			log.Printf("geoip: %d + %d ranges in %v", len(g.v4), len(g.v6), time.Since(t).Round(time.Millisecond))
		}()
	}
	if metrics == "" {
		return nil
	}
	db, err := sql.Open("sqlite3", "file:"+metrics+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return err
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS counts (day TEXT NOT NULL, metric TEXT NOT NULL, value TEXT NOT NULL,
		country TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, metric, value, country)) WITHOUT ROWID`); err != nil {
		return err
	}
	s.db = db
	go func() {
		for range time.Tick(time.Minute) {
			s.save()
		}
	}()
	go func() { // systemctl restart / stop: keep the last minute
		ch := make(chan os.Signal, 1)
		signal.Notify(ch, syscall.SIGTERM, syscall.SIGINT)
		<-ch
		s.save()
		os.Exit(0)
	}()
	return nil
}

func (s *stats) add(metric, value, country string, n int64) {
	if s == nil || s.db == nil || value == "" || n <= 0 {
		return
	}
	k := countKey{time.Now().UTC().Format("2006-01-02"), metric, value, country}
	s.mu.Lock()
	if _, ok := s.counts[k]; ok || len(s.counts) < maxKeys {
		s.counts[k] += n
	}
	s.mu.Unlock()
}

// save adds the counts since the last save to the db.
func (s *stats) save() {
	if s.db == nil {
		return
	}
	s.mu.Lock()
	counts := s.counts
	s.counts = map[countKey]int64{}
	s.mu.Unlock()
	if len(counts) == 0 {
		return
	}
	err := func() error {
		tx, err := s.db.Begin()
		if err != nil {
			return err
		}
		defer tx.Rollback()
		st, err := tx.Prepare(`INSERT INTO counts VALUES (?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET n = n + excluded.n`)
		if err != nil {
			return err
		}
		for k, n := range counts {
			if _, err := st.Exec(k.day, k.metric, k.value, k.country, n); err != nil {
				return err
			}
		}
		return tx.Commit()
	}()
	if err != nil {
		log.Printf("stats: %v", err)
	}
}

func (s *stats) country(r *http.Request) string { return s.geo.Load().country(clientIP(r)) }

// count is the middleware counting the requests of crawlers (people's are in the beacons).
func (s *stats) count(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
		if s.db == nil || !isBot(r) {
			return
		}
		path := r.URL.Path
		switch {
		case strings.HasPrefix(path, "/api/"):
			s.add("crawler", "api", "", 1)
		case strings.Contains(path, "sitemap") || path == "/robots.txt":
			s.add("crawler", "sitemap", "", 1)
		case !strings.Contains(path[strings.LastIndex(path, "/")+1:], "."): // not a file of the web app
			s.add("crawler", "page", "", 1)
		}
	})
}

func normTerm(q string) string {
	q = strings.ToLower(strings.Join(strings.Fields(q), " "))
	for utf8.RuneCountInString(q) > 60 {
		_, n := utf8.DecodeLastRuneInString(q)
		q = q[:len(q)-n]
	}
	return q
}

// the web app's route names (web/src/router.ts), search kinds, features without a request and devices
var (
	beaconPages = map[string]bool{"Welcome": true, "Home": true, "title": true, "fts": true, "dict": true, "Bookmarks": true,
		"Settings": true, "Abbreviations": true, "help": true, "names": true, "map": true, "NotFound": true}
	beaconSearches = map[string]bool{"title": true, "fts": true, "dict": true}
	beaconFeatures = map[string]bool{"audio": true, "scan": true, "alongside": true, "share": true, "copy": true, "star": true}
	beaconOS       = map[string]bool{"android": true, "ios": true, "mac": true, "windows": true, "linux": true, "chromeos": true, "other": true}
	beaconForms    = map[string]bool{"phone": true, "tablet": true, "desktop": true}
)

type beacon struct {
	Visit *struct {
		New, Day, Week, Month bool
		OS, Form              string
	} `json:"visit"`
	Pages    map[string]int64 `json:"pages"`
	Terms    [][2]string      `json:"terms"`    // [search kind, query]
	Ops      map[string]int64 `json:"ops"`      // the app's requests to the server (named queries, engine ops)
	Features map[string]int64 `json:"features"` // used without a request to the server
	Words    []string         `json:"words"`    // tapped in texts (op lookup)
}

// handleBeacon: POST /api/beacon from the web app (sendBeacon, text/plain json).
func (s *stats) handleBeacon(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
	var b beacon
	body, _ := io.ReadAll(io.LimitReader(r.Body, 8<<10))
	if s.db == nil || isBot(r) || json.Unmarshal(body, &b) != nil {
		return
	}
	c := s.country(r)
	if v := b.Visit; v != nil {
		kind := "returning"
		if v.New {
			kind = "new"
		}
		s.add("visit", kind, c, 1)
		os, form := v.OS, v.Form
		if !beaconOS[os] {
			os = "other"
		}
		if !beaconForms[form] {
			form = ""
		}
		for period, first := range map[string]bool{"day": v.Day, "week": v.Week, "month": v.Month} {
			if first { // the unique visitors of the period, by country and by device
				s.add("users", period, c, 1)
				s.add("os:"+period, os, "", 1)
				s.add("form:"+period, form, "", 1)
			}
		}
	}
	for p, n := range b.Pages {
		if beaconPages[p] {
			s.add("page", p, c, min(n, 200))
		}
	}
	for op, n := range b.Ops {
		if s.apis[op] {
			s.add("api", op, c, min(n, 500))
		}
	}
	for f, n := range b.Features {
		if beaconFeatures[f] {
			s.add("feature", f, c, min(n, 200))
		}
	}
	for i, w := range b.Words {
		if i == 50 {
			break
		}
		s.add("term:lookup", normTerm(w), "", 1)
	}
	for i, t := range b.Terms {
		if i == 20 {
			break
		}
		if q := normTerm(t[1]); beaconSearches[t[0]] && q != "" {
			s.add("search", t[0], c, 1)
			s.add("term:"+t[0], q, "", 1)
		}
	}
}

func (s *stats) routes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/beacon", s.handleBeacon)
	mux.HandleFunc("GET /stats", s.handlePage)
}
