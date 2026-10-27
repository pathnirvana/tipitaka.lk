package main

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"sync"
)

// SEO (tipitaka.app static.go): robots.txt and XML sitemaps generated from the tree in text.db. Every sutta is two
// pages for search engines, the pali text (/<key>/pali) and the sinhala translation (/<key>/sinh), linked to each other
// with hreflang (ssr.go). The two sitemaps hold ~16000 urls each (a sitemap holds 50000 at most). The pitaka flavor
// has one page per sutta: one sitemap, si.xml (its robots.txt is pitaka.lk's own, outside /main).

func (a *App) handleRobots(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	fmt.Fprintf(w, "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /tipitaka-query/\nSitemap: %s/sitemap.xml\n", a.site)
}

func (a *App) handleSitemapIndex(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	fmt.Fprint(w, `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)
	for _, l := range a.sitemapLangs() {
		fmt.Fprintf(w, "<sitemap><loc>%s/sitemaps/%s.xml</loc></sitemap>", a.site, l)
	}
	fmt.Fprint(w, `</sitemapindex>`)
}

func (a *App) handleSitemap(w http.ResponseWriter, r *http.Request) {
	lang, _ := strings.CutSuffix(r.PathValue("file"), ".xml")
	if !slices.Contains(a.sitemapLangs(), lang) {
		http.NotFound(w, r)
		return
	}
	nodes, err := a.sitemapNodes(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	fmt.Fprint(w, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)
	if lang != "pali" {
		fmt.Fprintf(w, "<url><loc>%s/</loc></url>", a.site)
	}
	for _, n := range nodes {
		if !a.fl.langs {
			fmt.Fprintf(w, "<url><loc>%s/%s</loc></url>", a.site, n.key)
			continue
		}
		if lang == "sinh" && n.paliOnly { // no translation: the page would only repeat the pali
			continue
		}
		fmt.Fprintf(w, "<url><loc>%s/%s/%s</loc></url>", a.site, n.key, lang)
	}
	fmt.Fprint(w, `</urlset>`)
}

func (a *App) sitemapLangs() []string {
	if !a.fl.langs {
		return []string{"si"}
	}
	return []string{"pali", "sinh"}
}

type sitemapNode struct {
	key      string
	paliOnly bool
}

// sitemapNodes: the nodes with text (tree order), read once
func (a *App) sitemapNodes(ctx context.Context) ([]sitemapNode, error) {
	a.sitemapOnce.Do(func() {
		rows, err := a.dbs.Text.QueryContext(ctx, `SELECT n.key, f.pali_only FROM node n JOIN file f ON f.id = n.file_id ORDER BY n.id`)
		if err != nil {
			a.sitemapErr = err
			return
		}
		defer rows.Close()
		for rows.Next() {
			var n sitemapNode
			if err := rows.Scan(&n.key, &n.paliOnly); err != nil {
				a.sitemapErr = err
				return
			}
			a.sitemap = append(a.sitemap, n)
		}
		a.sitemapErr = rows.Err()
	})
	return a.sitemap, a.sitemapErr
}

// ssrCache keeps rendered pages, bounded by their size (tipitaka.app ssr.go). Emptied when index.html changes.
type ssrCache struct {
	mu       sync.Mutex
	maxBytes int
	bytes    int
	order    []string
	items    map[string]ssrPage
}

func newSSRCache(maxBytes int) *ssrCache {
	return &ssrCache{maxBytes: maxBytes, items: map[string]ssrPage{}}
}

func (c *ssrCache) get(k string) (ssrPage, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	p, ok := c.items[k]
	return p, ok
}

func (c *ssrCache) put(k string, p ssrPage) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if old, ok := c.items[k]; ok {
		c.bytes -= len(old.html)
	} else {
		c.order = append(c.order, k)
	}
	c.items[k] = p
	c.bytes += len(p.html)
	for c.bytes > c.maxBytes && len(c.order) > 1 {
		c.bytes -= len(c.items[c.order[0]].html)
		delete(c.items, c.order[0])
		c.order = c.order[1:]
	}
}

func (c *ssrCache) clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items, c.order, c.bytes = map[string]ssrPage{}, nil, 0
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		if !strings.HasPrefix(r.URL.Path, "/api/") && !strings.HasPrefix(r.URL.Path, "/tipitaka-query/") {
			h.Set("X-Frame-Options", "SAMEORIGIN")
		}
		next.ServeHTTP(w, r)
	})
}
