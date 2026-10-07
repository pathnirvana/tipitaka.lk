package main

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// /tipitaka-query/version - old apps parse the number after the last 'v'
func handleVersion(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*") // desktop/app call this cross-origin (v2 bug A35)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Write([]byte("Tipitaka.lk v" + PublishedVersion))
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

// /tipitaka-query/latest-version - the version published on tipitaka.lk, fetched by this server so that the desktop
// app (http://localhost) does not need a cross-origin request. On tipitaka.lk itself this is the running version.
var latest struct {
	sync.Mutex
	value string
	at    time.Time
}

// LatestVersionURL is where the published version is read from (tests override it)
var LatestVersionURL = "https://tipitaka.lk/tipitaka-query/version"

func (a *App) handleLatestVersion(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	if strings.HasSuffix(r.Host, "tipitaka.lk") {
		w.Write([]byte("Tipitaka.lk v" + PublishedVersion))
		return
	}
	latest.Lock()
	defer latest.Unlock()
	if latest.value == "" || time.Since(latest.at) > time.Hour {
		client := http.Client{Timeout: 5 * time.Second}
		res, err := client.Get(LatestVersionURL)
		if err != nil {
			http.Error(w, "version check failed", http.StatusBadGateway)
			return
		}
		defer res.Body.Close()
		b, err := io.ReadAll(io.LimitReader(res.Body, 200))
		if err != nil || res.StatusCode != 200 || !strings.Contains(string(b), "v") {
			http.Error(w, "version check failed", http.StatusBadGateway)
			return
		}
		latest.value, latest.at = strings.TrimSpace(string(b)), time.Now()
	}
	w.Write([]byte(latest.value))
}
