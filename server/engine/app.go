package engine

// The engine inside the apps (server/mobile: Android and iOS through gomobile): the databases opened from files, and
// one entry point for the web app's requests - the named queries of queries.sql and the operations of Call.

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// OpenRO opens an sqlite file strictly read-only. The "file:" prefix is required: without it go-sqlite3 ignores the
// query string and opens the file read-write (the v2 bug).
func OpenRO(path string) (*sql.DB, error) {
	if _, err := os.Stat(path); err != nil {
		return nil, err
	}
	abs, _ := filepath.Abs(path)
	dsn := "file:" + (&url.URL{Path: abs}).EscapedPath() + "?mode=ro&immutable=1&_query_only=1"
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(4)
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	return db, nil
}

// OpenFiles opens text.db and dict.db (dictPath may be empty or missing: no dictionary).
func OpenFiles(textPath, dictPath string) (*Engine, error) {
	text, err := OpenRO(textPath)
	if err != nil {
		return nil, err
	}
	var dict *sql.DB
	if dictPath != "" {
		if _, err := os.Stat(dictPath); err == nil {
			if dict, err = OpenRO(dictPath); err != nil {
				text.Close()
				return nil, err
			}
		}
	}
	meta := map[string]string{}
	rows, err := text.Query("SELECT k, v FROM meta")
	if err != nil {
		text.Close()
		return nil, err
	}
	for rows.Next() {
		var k, v string
		if rows.Scan(&k, &v) == nil {
			meta[k] = v
		}
	}
	rows.Close()
	return New(text, dict, meta), nil
}

// Close closes the databases.
func (e *Engine) Close() {
	e.text.Close()
	if e.dict != nil {
		e.dict.Close()
	}
}

var (
	queriesOnce sync.Once
	queries     map[string]*NamedQuery
	queriesErr  error
)

// Queries are the named queries of queries.sql (parsed once).
func Queries() (map[string]*NamedQuery, error) {
	queriesOnce.Do(func() { queries, queriesErr = ParseQueries(QueriesSQL) })
	return queries, queriesErr
}

// QueryTimeout bounds a named query (full text search is the slowest).
const QueryTimeout = 3 * time.Second

// RunNamed validates the params (strings or JSON values) and runs a named query.
func (e *Engine) RunNamed(ctx context.Context, name string, raw map[string]any) ([]Row, error) {
	qs, err := Queries()
	if err != nil {
		return nil, err
	}
	q := qs[name]
	if q == nil {
		return nil, ErrNotFound
	}
	args, err := q.BindParams(raw)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, QueryTimeout)
	defer cancel()
	db := e.text
	if q.DB == "dict" {
		if e.dict == nil {
			return nil, ErrNoDict
		}
		db = e.dict
	}
	return q.Run(ctx, db, args)
}

// QueryJSON answers a request of the apps' bridge (dev-docs/native-bridge.md): {"query": "<named query>", params} or
// {"op": "<operation>", params} -> {"ok": result} or {"error": code, "message": text} (no query param or op param is
// named "query" or "op"). Safe for concurrent use.
func (e *Engine) QueryJSON(req string) string {
	var m map[string]any
	if err := json.Unmarshal([]byte(req), &m); err != nil {
		return `{"error":"bad_request","message":"invalid json"}`
	}
	var res any
	var err error
	if name, _ := m["query"].(string); name != "" {
		delete(m, "query")
		res, err = e.RunNamed(context.Background(), name, m)
	} else {
		op, _ := m["op"].(string)
		delete(m, "op")
		res, err = e.Call(context.Background(), op, MapParams(m))
	}
	if err != nil {
		code := ErrorCode(err)
		if errors.Is(err, ErrFtsSyntax) {
			code = "fts_syntax"
		}
		b, _ := json.Marshal(map[string]string{"error": code, "message": err.Error()})
		return string(b)
	}
	b, err := MarshalNoEscape(map[string]any{"ok": res})
	if err != nil {
		return `{"error":"internal","message":"encode failed"}`
	}
	return string(b)
}

// ---- the recitations' timing files ----

// AudioBaseURL is where the recitations and their timing files are (web/src/stores/audio.ts AUDIO_BASE_URL).
const AudioBaseURL = "https://sajjha.sgp1.cdn.digitaloceanspaces.com/original/"

var audioFileRe = regexp.MustCompile(`^[\w.@-]+\.(json|txt)$`)
var audioClient = &http.Client{Timeout: 15 * time.Second}

// AudioFile fetches a timing file of the recitations (<label>.json, .txt, .words.json) for pages that the CDN's CORS
// does not allow (the apps: app://, Wails, file:// origins): the text of the file, ErrNotFound when it has none.
func AudioFile(ctx context.Context, name string) (string, error) {
	if !audioFileRe.MatchString(name) {
		return "", &ParamError{"bad file name"}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, AudioBaseURL+name, nil)
	if err != nil {
		return "", err
	}
	res, err := audioClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNotFound || res.StatusCode == http.StatusForbidden {
		return "", ErrNotFound
	}
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("audio file %s: %s", name, res.Status)
	}
	b, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	return string(b), err
}
