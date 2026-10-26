// Package engine answers the operations of the tipitaka.lk api (/api/{op}, and later the native apps through gomobile,
// the same design as tipitaka.app's server/engine). The dictionary operations come from tipitaka.app (dict.go,
// normalize.go: keep them in sync); text, tree and search are the named queries of queries.sql (queries.go; the server: /api/q/{name}).
package engine

import (
	"database/sql"
	"errors"
	"strings"
)

// Version of the engine's answers (dictionary order and content, names, links): part of the ops' cache key
// (App.opsHash), so browsers fetch the answers again when it changes - bump it with any change to what the ops return.
const Version = "3"

// Engine holds the read-only databases.
type Engine struct {
	text *sql.DB
	dict *sql.DB // nil when dict.db is missing
	Meta map[string]string
}

// New wraps open read-only databases (dict may be nil).
func New(text, dict *sql.DB, meta map[string]string) *Engine {
	return &Engine{text: text, dict: dict, Meta: meta}
}

var (
	ErrNotFound = errors.New("not found")
	ErrNoDict   = errors.New("dictionary database not available")
)

// ParamError is a bad request parameter.
type ParamError struct{ Msg string }

func (e *ParamError) Error() string { return e.Msg }

// ErrTooBroad: a search that would match too much.
type ErrTooBroad struct{ Msg string }

func (e *ErrTooBroad) Error() string { return e.Msg }

// glob converts a user pattern to an sqlite GLOB pattern (only * and ? are special, [ ] are dropped).
func glob(p string) string {
	p = strings.NewReplacer("%", "*", "_", "?", "[", "", "]", "").Replace(p)
	for strings.Contains(p, "**") {
		p = strings.ReplaceAll(p, "**", "*")
	}
	return p
}
