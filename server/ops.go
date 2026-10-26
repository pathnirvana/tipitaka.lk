package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"tipitaka.lk/server/engine"
)

// engine operations (tipitaka.app api.go): GET /api/<op>?params (cacheable) or POST with a JSON object. The named
// queries (/api/q/<name>) move here op by op.

const maxOpBody = 16 << 10

var opErrorStatus = map[string]int{"bad_request": 400, "not_found": 404, "too_broad": 422, "timeout": 503, "no_dict": 503, "internal": 500}

func (a *App) handleOp(w http.ResponseWriter, r *http.Request) {
	op := r.PathValue("op")
	var p engine.Params
	etag := `W/"` + a.opsHash + `"`
	if r.Method == http.MethodPost {
		body, err := io.ReadAll(io.LimitReader(r.Body, maxOpBody))
		m := map[string]any{}
		if err != nil || json.Unmarshal(body, &m) != nil {
			writeJSON(w, 400, map[string]string{"error": "bad_request", "message": "bad json body"})
			return
		}
		p = engine.MapParams(m)
	} else {
		if len(r.URL.RawQuery) > maxOpBody {
			writeJSON(w, 400, map[string]string{"error": "bad_request", "message": "query too long"})
			return
		}
		if r.Header.Get("If-None-Match") == etag {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		p = engine.URLParams(r.URL.Query())
	}
	if heavyOps[op] {
		if !a.guard.api.acquire(r.Context(), apiWait) {
			a.guard.stats.apiBusy.Add(1)
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("Retry-After", "10")
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "busy", "message": "the server is busy, please retry"})
			return
		}
		defer a.guard.api.release()
	}
	res, err := a.eng.Call(r.Context(), op, p)
	if err != nil {
		code := engine.ErrorCode(err)
		if code == "internal" {
			log.Printf("api %s %s: %v", op, r.URL.RawQuery, err)
		}
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, opErrorStatus[code], map[string]string{"error": code, "message": err.Error()})
		return
	}
	w.Header().Set("ETag", etag)
	// responses only change with the data and the engine (opsHash): immutable when the client sends it (?v=)
	if op == "audio" { // a file of the recitations' CDN (the apps): it may be corrected
		w.Header().Set("Cache-Control", "public, max-age=3600")
	} else if r.Method == http.MethodGet && a.apiHash != "" && r.URL.Query().Get("v") == a.opsHash {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "public, max-age=300")
	}
	writeJSON(w, http.StatusOK, res)
}
