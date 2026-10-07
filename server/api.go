package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

const queryTimeout = 3 * time.Second

func (r Row) MarshalJSON() ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	for i, c := range r.cols {
		if i > 0 {
			b.WriteByte(',')
		}
		k, _ := marshalNoEscape(c)
		v, err := marshalNoEscape(r.vals[i])
		if err != nil {
			return nil, err
		}
		b.Write(k)
		b.WriteByte(':')
		b.Write(v)
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

func marshalNoEscape(v any) ([]byte, error) {
	var b bytes.Buffer
	enc := json.NewEncoder(&b)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimRight(b.Bytes(), "\n"), nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	b, err := marshalNoEscape(v)
	if err != nil {
		log.Printf("json encode: %v", err)
		return
	}
	w.Write(b)
}

func jsonError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, status, map[string]string{"error": msg})
}

// RunNamed validates params and runs a named query (also used by SSR).
func (a *App) RunNamed(ctx context.Context, name string, raw map[string]any) ([]Row, error) {
	q := a.queries[name]
	if q == nil {
		return nil, errNotFound
	}
	args, err := q.BindParams(raw)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()
	return q.Run(ctx, a.dbs.get(q.DB), args)
}

var errNotFound = errors.New("not found")

func (a *App) handleQuery(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if a.queries[name] == nil {
		jsonError(w, http.StatusNotFound, "unknown query "+name)
		return
	}
	raw := map[string]any{}
	if r.Method == http.MethodPost {
		body, err := io.ReadAll(io.LimitReader(r.Body, 4*maxStrParam))
		if err != nil || json.Unmarshal(body, &raw) != nil {
			jsonError(w, http.StatusBadRequest, "bad json body")
			return
		}
	} else {
		if len(r.URL.RawQuery) > 4*maxStrParam {
			jsonError(w, http.StatusBadRequest, "query string too long")
			return
		}
		for k, v := range r.URL.Query() {
			raw[k] = v[0]
		}
	}
	etag := `W/"` + a.apiHash + `"`
	isGet := r.Method == http.MethodGet || r.Method == http.MethodHead
	if isGet && strings.Contains(r.Header.Get("If-None-Match"), etag) {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	rows, err := a.RunNamed(r.Context(), name, raw)
	var pe *ParamError
	switch {
	case errors.As(err, &pe):
		jsonError(w, http.StatusBadRequest, pe.Error())
		return
	case errors.Is(err, ErrFtsSyntax):
		jsonError(w, http.StatusBadRequest, "fts_syntax")
		return
	case errors.Is(err, context.DeadlineExceeded):
		jsonError(w, http.StatusServiceUnavailable, "timeout")
		return
	case err != nil:
		log.Printf("query %s failed: %v", name, err)
		jsonError(w, http.StatusInternalServerError, "query failed")
		return
	}
	w.Header().Set("ETag", etag)
	if v, _ := raw["v"].(string); isGet && v != "" && v == a.apiHash {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}
	writeJSON(w, http.StatusOK, rows)
}

func (a *App) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "api_hash": a.apiHash,
		"content_hash": a.meta["content_hash"], "schema_version": a.meta["schema_version"], "db_version": a.meta["db_version"]})
}
