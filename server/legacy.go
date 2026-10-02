package main

import (
	"net/http"
	"os"
	"path/filepath"
)

// /tipitaka-query/version - old apps parse the number after the last 'v'
func handleVersion(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*") // desktop/app call this cross-origin (v2 bug A35)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Write([]byte(APPNAME))
}

func (a *App) handleBjtParams(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	if a.bjtDir != "" {
		w.Write([]byte("/bjt-scanned-pages|jpg"))
	}
}

// findBjtScans looks for locally downloaded BJT scans (only bjt_newbooks/jpg is supported)
func findBjtScans(userPath string) string {
	path := "/Pictures/bjt_newbooks/"
	if userPath != "" {
		path = userPath
	}
	for _, loc := range []string{"", "C:", "D:", "E:"} {
		full := filepath.Join(loc, path)
		if _, err := os.Stat(filepath.Join(full, "10", "DN1_Page_001.jpg")); err == nil {
			return full
		}
	}
	return ""
}
