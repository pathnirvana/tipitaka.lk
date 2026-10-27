//go:build desktop

// Desktop app (Windows, macOS; tipitaka.app's server/desktop.go): the server's handler (web app, api, ssr) in a Wails
// window, no port is opened. With -server it is the http server instead (LAN access, old systems without a webview).
package main

import (
	_ "embed"
	"log"
	"net/http"
	"os"
	"runtime"
	"slices"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed packaging/icons/mac/AppIcon.iconset/icon_256x256.png
var aboutIcon []byte

func main() {
	for i, a := range os.Args[1:] {
		if a == "-server" || a == "--server" {
			os.Args = slices.Delete(os.Args, i+1, i+2)
			serverMain()
			return
		}
	}
	root, err := findRoot("", "", flavors["lk"])
	if err != nil {
		log.Fatal(err)
	}
	app, err := NewApp(Config{Root: root})
	if err != nil {
		log.Fatal(err)
	}
	h := app.Handler()
	// the asset server injects the wails runtime into html, which it can't do in a gzipped response
	logRequests := os.Getenv("TIPITAKA_LOG") != ""
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if logRequests {
			log.Println(r.Method, r.URL)
		}
		r.Header.Del("Accept-Encoding")
		h.ServeHTTP(w, r)
	})

	opts := &options.App{
		Title:            "බුද්ධ ජයන්ති ත්‍රිපිටකය",
		Width:            1280,
		Height:           860,
		MinWidth:         360,
		MinHeight:        400,
		BackgroundColour: &options.RGBA{R: 251, G: 248, B: 243, A: 255},
		AssetServer:      &assetserver.Options{Handler: handler},
		Mac: &mac.Options{About: &mac.AboutInfo{Title: APPNAME,
			Message: "Suggestions and errors: pathnirvana@gmail.com", Icon: aboutIcon}},
	}
	if runtime.GOOS == "darwin" { // without an Edit menu copy/paste shortcuts don't work in the webview
		opts.Menu = menu.NewMenuFromItems(menu.AppMenu(), menu.EditMenu(), menu.WindowMenu())
	}
	if err := wails.Run(opts); err != nil {
		log.Fatal(err)
	}
}
