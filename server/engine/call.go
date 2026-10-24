package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Params are the parameters of an operation: url query values (HTTP) or a JSON object (native bridge).
type Params interface {
	Get(name string) string
}

// URLParams adapts url.Values.
type URLParams url.Values

func (u URLParams) Get(name string) string { return url.Values(u).Get(name) }

// MapParams adapts a decoded JSON object (numbers, bools and string lists are accepted).
type MapParams map[string]any

func (m MapParams) Get(name string) string {
	switch v := m[name].(type) {
	case nil:
		return ""
	case string:
		return v
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(v)
	case []any:
		parts := make([]string, 0, len(v))
		for _, x := range v {
			parts = append(parts, fmt.Sprint(x))
		}
		return strings.Join(parts, ",")
	default:
		return fmt.Sprint(v)
	}
}

const (
	maxParamLen = 2000
	callTimeout = 10 * time.Second
)

func str(p Params, name string) (string, error) {
	v := p.Get(name)
	if len(v) > maxParamLen {
		return "", &ParamError{name + " is too long"}
	}
	return v, nil
}

func num(p Params, name string, def int) (int, error) {
	v := p.Get(name)
	if v == "" {
		return def, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return 0, &ParamError{name + " must be a number"}
	}
	return n, nil
}

func flag(p Params, name string) bool {
	v := p.Get(name)
	return v == "1" || v == "true"
}

// list splits a comma separated parameter.
func splitList(p Params, name string) []string {
	v := strings.TrimSpace(p.Get(name))
	if v == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := parts[:0]
	for _, x := range parts {
		if x = strings.TrimSpace(x); x != "" {
			out = append(out, x)
		}
	}
	if len(out) > 50 {
		out = out[:50]
	}
	return out
}

// Ops are the names accepted by Call.
var Ops = []string{"meta", "dicts", "dict", "lookup"}

// Call runs an operation. Errors are *ParamError (bad request), ErrNotFound, *ErrTooBroad or internal.
func (e *Engine) Call(ctx context.Context, op string, p Params) (any, error) {
	ctx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	switch op {
	case "meta":
		return e.MetaInfo(), nil
	case "dicts":
		return e.Dicts(ctx)
	case "dict", "lookup":
		w, err := str(p, "w")
		if err != nil {
			return nil, err
		}
		limit, err := num(p, "limit", 0)
		if err != nil {
			return nil, err
		}
		if op == "lookup" {
			return e.Lookup(ctx, w, splitList(p, "dicts"), limit)
		}
		return e.Dictionary(ctx, w, splitList(p, "dicts"), limit)
	}
	return nil, ErrNotFound
}

// Meta is the public build information.
type Meta struct {
	ContentHash string `json:"contentHash"`
	ApiHash     string `json:"apiHash"`
	DbVersion   string `json:"dbVersion"`
	BuiltAt     string `json:"builtAt"`
	DpdVersion  string `json:"dpdVersion,omitempty"`
	DpdCitation string `json:"dpdCitation,omitempty"`
	HasDict     bool   `json:"hasDict"`
}

func (e *Engine) MetaInfo() Meta {
	m := Meta{ContentHash: e.Meta["content_hash"], ApiHash: e.Meta["api_hash"], DbVersion: e.Meta["db_version"], BuiltAt: e.Meta["built_at"],
		HasDict: e.dict != nil}
	if e.dict != nil {
		e.dict.QueryRow("SELECT v FROM meta WHERE k = 'dpd_version'").Scan(&m.DpdVersion)
		e.dict.QueryRow("SELECT v FROM meta WHERE k = 'dpd_citation'").Scan(&m.DpdCitation)
	}
	return m
}

// ErrorCode classifies an error for clients: bad_request, not_found, too_broad, timeout, no_dict, internal.
func ErrorCode(err error) string {
	var pe *ParamError
	var tb *ErrTooBroad
	switch {
	case errors.As(err, &pe):
		return "bad_request"
	case errors.Is(err, ErrNotFound):
		return "not_found"
	case errors.As(err, &tb):
		return "too_broad"
	case errors.Is(err, context.DeadlineExceeded):
		return "timeout"
	case errors.Is(err, ErrNoDict):
		return "no_dict"
	}
	return "internal"
}

// QueryJSON is the entry point of the native bridge: {"op": "...", ...params} -> {"ok": result} or
// {"error": code, "message": text}.
func (e *Engine) QueryJSON(req string) string {
	var m map[string]any
	if err := json.Unmarshal([]byte(req), &m); err != nil {
		return `{"error":"bad_request","message":"invalid json"}`
	}
	op, _ := m["op"].(string)
	res, err := e.Call(context.Background(), op, MapParams(m))
	if err != nil {
		b, _ := json.Marshal(map[string]string{"error": ErrorCode(err), "message": err.Error()})
		return string(b)
	}
	b, err := json.Marshal(map[string]any{"ok": res})
	if err != nil {
		return `{"error":"internal","message":"encode failed"}`
	}
	return string(b)
}
