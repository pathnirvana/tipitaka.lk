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
	"time"

	"github.com/skratchdot/open-golang/open"
)

const APPNAME = "Tipitaka.lk v3.0" // the number after 'v' is compared by old apps (Settings version check)

func main() {
	listen := flag.String("listen", "127.0.0.1:8400", "address to listen on (use 0.0.0.0:8400 to allow LAN access)")
	noOpen := flag.Bool("no-open", false, "do not open the browser")
	rootPath := flag.String("root-path", "", "folder containing dist/ (or web/dist/) and db/, relative to the binary or absolute")
	bjtPath := flag.String("bjt-path", "", "local folder with BJT scanned pages (e.g. /Pictures/bjt_newbooks)")
	dbDir := flag.String("db-dir", "", "folder with text.db and dict.db (default <root>/db)")
	flag.Parse()

	root, err := findRoot(*rootPath, *dbDir)
	if err != nil {
		log.Fatal(err)
	}
	app, err := NewApp(Config{Root: root, BjtPath: *bjtPath, DBDir: *dbDir})
	if err != nil {
		log.Fatal(err)
	}
	url := "http://" + strings.Replace(*listen, "0.0.0.0", "localhost", 1)
	printBox(url, root)
	srv := &http.Server{Addr: *listen, Handler: app.Handler(), ReadHeaderTimeout: 10 * time.Second, WriteTimeout: 60 * time.Second}
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
func findRoot(rootPath, dbDir string) (string, error) {
	var candidates []string
	if filepath.IsAbs(rootPath) {
		candidates = append(candidates, rootPath)
	} else {
		if exe, err := os.Executable(); err == nil {
			candidates = append(candidates, filepath.Join(filepath.Dir(exe), rootPath))
		}
		if cwd, err := os.Getwd(); err == nil {
			candidates = append(candidates, filepath.Join(cwd, rootPath), cwd, filepath.Join(cwd, ".."))
		}
	}
	for _, c := range candidates {
		if dbDir != "" {
			if _, err := os.Stat(filepath.Join(c, "web", "dist", "index.html")); err == nil {
				return filepath.Clean(c), nil
			}
			if _, err := os.Stat(filepath.Join(c, "dist", "index.html")); err == nil {
				return filepath.Clean(c), nil
			}
			continue
		}
		if _, err := os.Stat(filepath.Join(c, "db", "text.db")); err == nil {
			return filepath.Clean(c), nil
		}
	}
	return "", fmt.Errorf("could not find db/text.db in %v (use -root-path)", candidates)
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
	dbs       *DBs
	queries   map[string]*NamedQuery
	apiHash   string
	meta      map[string]string
	distDir   string
	indexHTML string
	bjtDir    string
}

type Config struct {
	Root    string
	BjtPath string
	DBDir   string // default <Root>/db
	// IndexHTML overrides dist/index.html (tests)
	IndexHTML string
}

func NewApp(cfg Config) (*App, error) {
	a := &App{cfg: cfg}
	var err error
	if a.queries, err = ParseQueries(queriesSQL); err != nil {
		return nil, err
	}
	dbDir := cfg.DBDir
	if dbDir == "" {
		dbDir = filepath.Join(cfg.Root, "db")
	}
	if a.dbs, err = OpenDBs(dbDir); err != nil {
		return nil, err
	}
	if a.meta, err = a.dbs.Meta(); err != nil {
		return nil, err
	}
	a.apiHash = a.meta["api_hash"]
	for _, d := range []string{filepath.Join("web", "dist"), "dist"} { // repo checkout first, release layout second
		if _, err := os.Stat(filepath.Join(cfg.Root, d, "index.html")); err == nil {
			a.distDir = filepath.Join(cfg.Root, d)
			break
		}
	}
	a.indexHTML = cfg.IndexHTML
	if a.indexHTML == "" {
		if a.distDir == "" {
			return nil, fmt.Errorf("web build not found in %s/dist or %s/web/dist", cfg.Root, cfg.Root)
		}
		b, err := os.ReadFile(filepath.Join(a.distDir, "index.html"))
		if err != nil {
			return nil, err
		}
		a.indexHTML = string(b)
	}
	a.bjtDir = findBjtScans(cfg.BjtPath)
	return a, nil
}

func (a *App) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/q/{name}", a.handleQuery)
	mux.HandleFunc("POST /api/q/{name}", a.handleQuery)
	mux.HandleFunc("GET /api/health", a.handleHealth)
	mux.HandleFunc("GET /tipitaka-query/version", handleVersion)
	mux.HandleFunc("GET /tipitaka-query/bjt-params", a.handleBjtParams)
	if a.bjtDir != "" {
		mux.Handle("GET /bjt-scanned-pages/", http.StripPrefix("/bjt-scanned-pages/", http.FileServer(http.Dir(a.bjtDir))))
	}
	mux.HandleFunc("GET /", a.handleStatic)
	return recoverMiddleware(gzipMiddleware(mux))
}
