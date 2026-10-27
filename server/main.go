// Tipitaka.lk v3 server: serves the web app, named read-only SQL queries (/api/q/...) over db/text.db and
// db/dict.db, SEO/SSR injection for sutta pages and the legacy /tipitaka-query endpoints.
// The same binary is the offline desktop app.
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/skratchdot/open-golang/open"
	"tipitaka.lk/server/engine"
)

const APPNAME = "Tipitaka.lk v3.0"

// PublishedVersion is what /tipitaka-query/version reports. Old apps compare it with their own version and ask the
// user to update when it is larger - keep 2.0 until the v3 Android/iOS/desktop builds are published (-published-version 3.0).
var PublishedVersion = "2.0"

// serverMain is the http server: the website, and the plain desktop zip (it opens the browser). The store apps run the
// same handler in a Wails window (desktop.go, -tags desktop).
func serverMain() {
	listen := flag.String("listen", "127.0.0.1:8400", "address to listen on (use 0.0.0.0:8400 to allow LAN access)")
	noOpen := flag.Bool("no-open", false, "do not open the browser")
	rootPath := flag.String("root-path", "", "folder containing dist/ (or web/dist/) and db/, relative to the binary or absolute")
	bjtPath := flag.String("bjt-path", "", "local folder with BJT scanned pages (e.g. /Pictures/bjt_newbooks)")
	dbDir := flag.String("db-dir", "", "folder with text.db and dict.db (default <root>/db)")
	site := flag.String("site", "", "public url of the site (canonical links, sitemaps; default https://tipitaka.lk, pitaka: https://pitaka.lk/main)")
	flavorName := flag.String("flavor", "lk", "lk: tipitaka.lk; pitaka: the pitaka.lk reader, served under /main (flavor.go)")
	flag.StringVar(&PublishedVersion, "published-version", PublishedVersion, "version reported to apps by /tipitaka-query/version")
	metrics := flag.String("metrics", "", "sqlite db for the usage statistics of the website (empty: none, as in the desktop app)")
	geo := flag.String("geoip", "", "DB-IP country csv(.gz) for the countries of the statistics")
	flag.Parse()
	if u := os.Getenv("TIPITAKA_LATEST_VERSION_URL"); u != "" {
		LatestVersionURL = u
	}

	fl, ok := flavors[*flavorName]
	if !ok {
		log.Fatalf("unknown flavor %q (lk or pitaka)", *flavorName)
	}
	root, err := findRoot(*rootPath, *dbDir, fl)
	if err != nil {
		log.Fatal(err)
	}
	app, err := NewApp(Config{Root: root, BjtPath: *bjtPath, DBDir: *dbDir, Site: *site, Flavor: fl.name})
	if err != nil {
		log.Fatal(err)
	}
	if err := app.stats.start(*metrics, *geo, os.Getenv("STATS_PASSWORD")); err != nil {
		log.Fatal(err)
	}
	// localhost, not 127.0.0.1: the recitation CDN allows only the origins http://localhost:8400 (and tipitaka.lk) - CORS
	url := "http://" + strings.NewReplacer("0.0.0.0", "localhost", "127.0.0.1", "localhost").Replace(*listen) + fl.base
	printBox(url, root)
	go app.guard.logEvery(10 * time.Minute)
	srv := &http.Server{Addr: *listen, Handler: app.Handler(), ReadHeaderTimeout: 10 * time.Second, WriteTimeout: 60 * time.Second,
		IdleTimeout: 120 * time.Second}
	if !*noOpen {
		go func() {
			time.Sleep(300 * time.Millisecond)
			if err := open.Start(url); err != nil {
				log.Printf("failed to open %s: %v", url, err)
			}
		}()
	}
	log.Fatal(srv.ListenAndServe())
}

// findRoot locates the folder holding the web build and the dbs.
func findRoot(rootPath, dbDir string, fl flavor) (string, error) {
	var candidates []string
	if filepath.IsAbs(rootPath) {
		candidates = append(candidates, rootPath)
	} else {
		if exe, err := os.Executable(); err == nil {
			candidates = append(candidates, filepath.Join(filepath.Dir(exe), rootPath),
				filepath.Join(filepath.Dir(exe), "..", "Resources", rootPath)) // macOS .app bundle
		}
		if cwd, err := os.Getwd(); err == nil {
			candidates = append(candidates, filepath.Join(cwd, rootPath), cwd, filepath.Join(cwd, ".."))
		}
	}
	for _, c := range candidates {
		if dbDir != "" {
			for _, d := range fl.distDirs {
				if _, err := os.Stat(filepath.Join(c, d, "index.html")); err == nil {
					return filepath.Clean(c), nil
				}
			}
			continue
		}
		if _, err := os.Stat(filepath.Join(c, "db", fl.textDB)); err == nil {
			return filepath.Clean(c), nil
		}
	}
	return "", fmt.Errorf("could not find db/%s in %v (use -root-path)", fl.textDB, candidates)
}

func printBox(url, root string) {
	lines := []string{APPNAME, "┈┈┈┈┈┈┈┈┈┈┈┈", url, "Visit the above URL in your browser to see the App.", "┄┄┄┄┄┄┄┄┄┈┈┈",
		"Suggestions and Errors - path.nirvana@gmail.com", "┄┄┄┄┄┄┄┄┄┈┈┈", "You can check if there is a newer version at",
		"https://github.com/pathnirvana/tipitaka.lk/releases"}
	const width = 60
	fmt.Println("┏" + strings.Repeat("━", width) + "┓")
	for _, l := range lines {
		n := len([]rune(l))
		pad := (width - n) / 2
		fmt.Println("┃" + strings.Repeat(" ", pad) + l + strings.Repeat(" ", width-pad-n) + "┃")
	}
	fmt.Println("┗" + strings.Repeat("━", width) + "┛")
	fmt.Println("serving from", root)
}

// App holds the shared state of the server.
type App struct {
	cfg       Config
	fl        flavor
	dbs       *DBs
	queries   map[string]*engine.NamedQuery
	apiHash   string
	opsHash   string // apiHash and the engine's version: the cache key of /api/{op} (ops.go)
	meta      map[string]string
	distDir   string
	indexHTML string
	indexMod  time.Time // mtime of dist/index.html when it was read (reloaded when the web app is rebuilt)
	indexMu   sync.Mutex
	bjtDir    string
	site      string // https://tipitaka.lk, https://pitaka.lk/main (canonical links, sitemaps)
	guard     *guard
	eng       *engine.Engine
	ssr       *ssrCache
	stats     *stats // usage statistics of the website (stats.go)
	// sitemap nodes, read once
	sitemapOnce sync.Once
	sitemap     []sitemapNode
	sitemapErr  error
}

type Config struct {
	Root    string
	BjtPath string
	DBDir   string // default <Root>/db
	Site    string // default: the flavor's (https://tipitaka.lk)
	Flavor  string // "" or lk: tipitaka.lk, pitaka: the pitaka.lk reader (flavor.go)
	// IndexHTML overrides dist/index.html (tests)
	IndexHTML string
}

func NewApp(cfg Config) (*App, error) {
	if cfg.Flavor == "" {
		cfg.Flavor = "lk"
	}
	fl, ok := flavors[cfg.Flavor]
	if !ok {
		return nil, fmt.Errorf("unknown flavor %q", cfg.Flavor)
	}
	a := &App{cfg: cfg, fl: fl, site: strings.TrimRight(cfg.Site, "/"), guard: newGuard(), ssr: newSSRCache(32 << 20)}
	if a.site == "" {
		a.site = fl.site
	}
	var err error
	if a.queries, err = engine.ParseQueries(engine.QueriesSQL); err != nil {
		return nil, err
	}
	a.stats = newStats(a.queries)
	dbDir := cfg.DBDir
	if dbDir == "" {
		dbDir = filepath.Join(cfg.Root, "db")
	}
	if a.dbs, err = OpenDBs(dbDir, fl.textDB); err != nil {
		return nil, err
	}
	if a.meta, err = a.dbs.Meta(); err != nil {
		return nil, err
	}
	a.apiHash = a.meta["api_hash"]
	a.opsHash = a.apiHash + "-" + engine.Version
	a.eng = engine.New(a.dbs.Text, a.dbs.Dict, a.meta)
	for _, d := range fl.distDirs {
		if _, err := os.Stat(filepath.Join(cfg.Root, d, "index.html")); err == nil {
			a.distDir = filepath.Join(cfg.Root, d)
			break
		}
	}
	a.indexHTML = cfg.IndexHTML
	if a.indexHTML == "" {
		if a.distDir == "" {
			return nil, fmt.Errorf("web build not found in %s/%s", cfg.Root, strings.Join(fl.distDirs, " or "))
		}
		if _, err := a.currentIndex(); err != nil {
			return nil, err
		}
	}
	a.bjtDir = findBjtScans(cfg.BjtPath)
	return a, nil
}

// currentIndex returns dist/index.html, re-reading it when the file changed (e.g. npm run build:web while running)
func (a *App) currentIndex() (string, error) {
	a.indexMu.Lock()
	defer a.indexMu.Unlock()
	if a.cfg.IndexHTML != "" {
		return a.cfg.IndexHTML, nil
	}
	path := filepath.Join(a.distDir, "index.html")
	st, err := os.Stat(path)
	if err != nil {
		if a.indexHTML != "" {
			return a.indexHTML, nil // keep serving the last good copy during a rebuild
		}
		return "", err
	}
	if a.indexHTML == "" || !st.ModTime().Equal(a.indexMod) {
		b, err := os.ReadFile(path)
		if err != nil {
			return a.indexHTML, err
		}
		a.indexHTML, a.indexMod = string(b), st.ModTime()
		a.ssr.clear() // pages rendered from the old build
	}
	return a.indexHTML, nil
}

func (a *App) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/q/{name}", a.handleQuery)
	mux.HandleFunc("POST /api/q/{name}", a.handleQuery)
	mux.HandleFunc("GET /api/health", a.handleHealth)
	mux.HandleFunc("GET /api/{op}", a.handleOp)
	mux.HandleFunc("POST /api/{op}", a.handleOp)
	mux.HandleFunc("GET /robots.txt", a.handleRobots)
	mux.HandleFunc("GET /sitemap.xml", a.handleSitemapIndex)
	mux.HandleFunc("GET /sitemaps/{file}", a.handleSitemap)
	if a.fl.legacy {
		mux.HandleFunc("GET /tipitaka-query/version", handleVersion)
		mux.HandleFunc("GET /tipitaka-query/bjt-params", a.handleBjtParams)
		mux.HandleFunc("GET /tipitaka-query/latest-version", a.handleLatestVersion)
		if a.bjtDir != "" {
			mux.Handle("GET /bjt-scanned-pages/", http.StripPrefix("/bjt-scanned-pages/", http.FileServer(http.Dir(a.bjtDir))))
		}
	}
	a.stats.routes(mux) // /api/beacon, /stats (stats.go)
	mux.HandleFunc("GET /", a.handleStatic)
	return recoverMiddleware(a.fl.withBase(securityHeaders(a.stats.count(gzipMiddleware(mux)))))
}
