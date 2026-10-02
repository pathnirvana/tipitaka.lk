package main

import (
	"context"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

//go:embed queries.sql
var queriesSQL string

// NamedQuery is one statement from queries.sql (parsed exactly like shared/queries.ts).
type NamedQuery struct {
	Name    string
	DB      string
	Params  map[string]string // name -> "str" | "int"
	MaxRows int
	SQL     string
}

const maxStrParam = 64 * 1024

var (
	paramRe  = regexp.MustCompile(`(?i):([a-z_][a-z0-9_]*)`)
	headerRe = regexp.MustCompile(`^-- (name|db|params|max_rows):\s*(.*)$`)
	blockRe  = regexp.MustCompile(`(?m)^-- name:`)
)

func ParseQueries(text string) (map[string]*NamedQuery, error) {
	out := map[string]*NamedQuery{}
	locs := blockRe.FindAllStringIndex(text, -1)
	for i, loc := range locs {
		end := len(text)
		if i+1 < len(locs) {
			end = locs[i+1][0]
		}
		lines := strings.Split(text[loc[0]:end], "\n")
		header := map[string]string{}
		j := 0
		for ; j < len(lines); j++ {
			m := headerRe.FindStringSubmatch(lines[j])
			if m == nil {
				break
			}
			header[m[1]] = strings.TrimSpace(m[2])
		}
		sqlText := strings.TrimSpace(strings.Join(lines[j:], "\n"))
		sqlText = strings.TrimSpace(strings.TrimSuffix(sqlText, ";"))
		name := header["name"]
		if name == "" || out[name] != nil {
			return nil, fmt.Errorf("queries.sql: missing or duplicate name '%s'", name)
		}
		if header["db"] != "text" && header["db"] != "dict" {
			return nil, fmt.Errorf("queries.sql %s: bad db '%s'", name, header["db"])
		}
		q := &NamedQuery{Name: name, DB: header["db"], Params: map[string]string{}, MaxRows: 1000, SQL: sqlText}
		for _, p := range strings.Fields(header["params"]) {
			pn, pt, _ := strings.Cut(p, ":")
			if pt != "str" && pt != "int" {
				return nil, fmt.Errorf("queries.sql %s: bad param type %s", name, p)
			}
			q.Params[pn] = pt
		}
		used := map[string]bool{}
		for _, m := range paramRe.FindAllStringSubmatch(sqlText, -1) {
			used[m[1]] = true
			if q.Params[m[1]] == "" {
				return nil, fmt.Errorf("queries.sql %s: undeclared param :%s", name, m[1])
			}
		}
		for p := range q.Params {
			if !used[p] {
				return nil, fmt.Errorf("queries.sql %s: unused param %s", name, p)
			}
		}
		if sqlText == "" || strings.Contains(sqlText, ";") {
			return nil, fmt.Errorf("queries.sql %s: empty sql or multiple statements", name)
		}
		if mr := header["max_rows"]; mr != "" {
			n, err := strconv.Atoi(mr)
			if err != nil {
				return nil, fmt.Errorf("queries.sql %s: bad max_rows", name)
			}
			q.MaxRows = n
		}
		out[name] = q
	}
	return out, nil
}

// ParamError is a client error (HTTP 400).
type ParamError struct{ msg string }

func (e *ParamError) Error() string { return e.msg }

// BindParams converts raw values (strings from a query string, or JSON values) to typed named args.
func (q *NamedQuery) BindParams(raw map[string]any) ([]any, error) {
	args := make([]any, 0, len(q.Params))
	for pn, pt := range q.Params {
		v, ok := raw[pn]
		if !ok || v == nil {
			return nil, &ParamError{"missing param " + pn}
		}
		switch pt {
		case "int":
			var n int64
			switch t := v.(type) {
			case string:
				x, err := strconv.ParseInt(t, 10, 64)
				if err != nil {
					return nil, &ParamError{"param " + pn + " must be an int32"}
				}
				n = x
			case int:
				n = int64(t)
			case int64:
				n = t
			case float64:
				if t != math.Trunc(t) {
					return nil, &ParamError{"param " + pn + " must be an int32"}
				}
				n = int64(t)
			default:
				return nil, &ParamError{"param " + pn + " must be an int32"}
			}
			if n > math.MaxInt32 || n < -math.MaxInt32 {
				return nil, &ParamError{"param " + pn + " must be an int32"}
			}
			args = append(args, sql.Named(pn, n))
		case "str":
			s, ok := v.(string)
			if !ok || len(s) > maxStrParam || strings.ContainsRune(s, 0) {
				return nil, &ParamError{"param " + pn + " must be a string"}
			}
			args = append(args, sql.Named(pn, s))
		}
	}
	return args, nil
}

var ErrFtsSyntax = errors.New("fts_syntax")

// Run executes the query and returns rows as ordered column/value pairs.
func (q *NamedQuery) Run(ctx context.Context, db *sql.DB, args []any) ([]Row, error) {
	rows, err := db.QueryContext(ctx, q.SQL, args...)
	if err != nil {
		return nil, classify(err)
	}
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	out := []Row{}
	for rows.Next() {
		if len(out) >= q.MaxRows {
			break
		}
		vals := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, classify(err)
		}
		r := Row{cols: cols, vals: vals}
		for i, v := range vals {
			if b, ok := v.([]byte); ok {
				r.vals[i] = string(b)
			}
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, classify(err)
	}
	return out, nil
}

func classify(err error) error {
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return context.DeadlineExceeded
	}
	msg := err.Error()
	if strings.Contains(msg, "malformed MATCH") || strings.Contains(msg, "fts4") || strings.Contains(msg, "unable to use function MATCH") {
		return ErrFtsSyntax
	}
	if strings.Contains(msg, "interrupted") {
		return context.DeadlineExceeded
	}
	return err
}

// Row keeps the column order of the result for JSON output.
type Row struct {
	cols []string
	vals []any
}

func (r Row) Get(col string) any {
	for i, c := range r.cols {
		if c == col {
			return r.vals[i]
		}
	}
	return nil
}
func (r Row) Str(col string) string { s, _ := r.Get(col).(string); return s }
func (r Row) Int(col string) int {
	switch v := r.Get(col).(type) {
	case int64:
		return int(v)
	case float64:
		return int(v)
	}
	return 0
}
