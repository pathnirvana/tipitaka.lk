package main

import (
	"context"
	"log"
	"net/http"
	"regexp"
	"runtime"
	"sync/atomic"
	"time"
)

// Load guard (tipitaka.app guard.go). tipitaka.lk shares the 1 CPU / 1 GB droplet with tipitaka.app: crawlers ask for
// thousands of pages (16000 texts x 2 languages) and without a bound the renders pile up, nginx times out (502) and
// memory grows into swap, also for the other sites (tipitaka.app 2026-10-19). So:
//   - at most ssrSlots renders at once; a request that gets no slot within ssrWait is shed: a person gets the app
//     shell at once (the app renders in the browser), a crawler 503 + Retry-After (search engines slow down, keep the
//     page);
//   - the expensive api ops (full text search) have their own slots, busy: 503 busy;
//   - counters for /api/health and a log line every 10 minutes.

const (
	ssrSlots  = 4 // one CPU: more do not add throughput (Go conversion: ~270 of the longest pages/s on one Mac core), 4 overlap disk reads
	ssrWait   = 1500 * time.Millisecond
	apiSlots  = 3
	apiWait   = 5 * time.Second
	retryBots = "120"
)

// heavy named queries (the others are a few indexed sqlite reads): full text search and the 30000 row title index
var heavyOps = map[string]bool{"fts.candidates": true, "fts.count": true, "tree.titleIndex": true}

var botRe = regexp.MustCompile(`(?i)bot\b|bot/|crawl|spider|slurp|facebookexternalhit|bingpreview|mediapartners|ia_archiver|` +
	`python-requests|python-urllib|aiohttp|scrapy|httpclient|go-http-client|okhttp|wget|curl|libwww|java/|headless|` +
	`petalbot|bytespider|gptbot|claudebot|ccbot|amazonbot|perplexity|yandex|baidu|semrush|ahrefs|mj12|dotbot|dataforseo|` +
	`seznam|sogou|applebot|duckduck|qwant|imagesift|meta-externalagent|timpibot|diffbot`)

func isBot(r *http.Request) bool {
	ua := r.UserAgent()
	return ua == "" || botRe.MatchString(ua)
}

type slots struct{ ch chan struct{} }

func newSlots(n int) *slots { return &slots{ch: make(chan struct{}, n)} }

// acquire waits up to wait for a slot (false: none, or the request went away)
func (s *slots) acquire(ctx context.Context, wait time.Duration) bool {
	select {
	case s.ch <- struct{}{}:
		return true
	default:
	}
	t := time.NewTimer(wait)
	defer t.Stop()
	select {
	case s.ch <- struct{}{}:
		return true
	case <-t.C:
		return false
	case <-ctx.Done():
		return false
	}
}
func (s *slots) release()   { <-s.ch }
func (s *slots) inUse() int { return len(s.ch) }

type guardStats struct {
	renders, cacheHits, shedPeople, shedBots, apiBusy, botRequests atomic.Int64
}

type guard struct {
	ssr, api *slots
	stats    guardStats
	started  time.Time
}

func newGuard() *guard {
	return &guard{ssr: newSlots(ssrSlots), api: newSlots(apiSlots), started: time.Now()}
}

// snapshot for /api/health
func (g *guard) snapshot() map[string]any {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return map[string]any{
		"uptime": time.Since(g.started).Round(time.Second).String(), "rendering": g.ssr.inUse(), "searching": g.api.inUse(),
		"renders": g.stats.renders.Load(), "cacheHits": g.stats.cacheHits.Load(), "shedPeople": g.stats.shedPeople.Load(),
		"shedBots": g.stats.shedBots.Load(), "apiBusy": g.stats.apiBusy.Load(), "botRequests": g.stats.botRequests.Load(),
		"heapMB": m.HeapAlloc >> 20, "sysMB": m.Sys >> 20, "goroutines": runtime.NumGoroutine(),
	}
}

// logEvery writes the counters of the last period (journalctl -u tipitaka_lk)
func (g *guard) logEvery(d time.Duration) {
	var last [6]int64
	for range time.Tick(d) {
		cur := [6]int64{g.stats.renders.Load(), g.stats.cacheHits.Load(), g.stats.shedPeople.Load(), g.stats.shedBots.Load(),
			g.stats.apiBusy.Load(), g.stats.botRequests.Load()}
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		log.Printf("load %v: renders %d, cache hits %d, shed people %d, shed bots %d, api busy %d, bot requests %d; heap %d MB",
			d, cur[0]-last[0], cur[1]-last[1], cur[2]-last[2], cur[3]-last[3], cur[4]-last[4], cur[5]-last[5], m.HeapAlloc>>20)
		last = cur
	}
}
