package main

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

var staticExt = map[string]bool{".js": true, ".css": true, ".png": true, ".jpg": true, ".jpeg": true, ".gif": true,
	".svg": true, ".ico": true, ".json": true, ".txt": true, ".map": true, ".woff": true, ".woff2": true, ".ttf": true,
	".webmanifest": true, ".xml": true, ".html": true, ".m4a": true, ".mp3": true}

func (a *App) handleStatic(w http.ResponseWriter, r *http.Request) {
	p := path.Clean("/" + r.URL.Path)
	if p != "/" && a.distDir != "" {
		full := filepath.Join(a.distDir, filepath.FromSlash(p))
		if st, err := os.Stat(full); err == nil && !st.IsDir() {
			switch {
			case strings.HasPrefix(p, "/assets/"):
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			case p == "/index.html":
				a.serveIndex(w, r)
				return
			default:
				w.Header().Set("Cache-Control", "public, max-age=86400")
			}
			http.ServeFile(w, r, full)
			return
		}
	}
	// missing static files are 404, everything else is the SPA (some sutta keys contain a dot e.g. atta-ap-dhs-2-1-1.1)
	if staticExt[strings.ToLower(path.Ext(p))] {
		http.NotFound(w, r)
		return
	}
	a.serveIndex(w, r)
}
