package main

import (
	"log"
	"net/http"
	"runtime/debug"

	"github.com/klauspost/compress/gzhttp"
)

func recoverMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("panic serving %s: %v\n%s", r.URL.Path, err, debug.Stack())
				http.Error(w, "internal error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func gzipMiddleware(next http.Handler) http.Handler {
	return gzhttp.GzipHandler(next)
}
