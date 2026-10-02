package main

import (
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

// DBs holds read-only connections to text.db and dict.db.
type DBs struct {
	Text *sql.DB
	Dict *sql.DB
}

// openRO opens an sqlite file strictly read-only. The "file:" prefix is required: without it go-sqlite3
// ignores the query string and opens the file read-write (the v2 bug).
func openRO(path string) (*sql.DB, error) {
	if _, err := os.Stat(path); err != nil {
		return nil, err
	}
	abs, _ := filepath.Abs(path)
	dsn := "file:" + (&url.URL{Path: abs}).EscapedPath() + "?mode=ro&immutable=1&_query_only=1"
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(4)
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	return db, nil
}

func OpenDBs(dir string) (*DBs, error) {
	text, err := openRO(filepath.Join(dir, "text.db"))
	if err != nil {
		return nil, err
	}
	dict, err := openRO(filepath.Join(dir, "dict.db"))
	if err != nil {
		return nil, err
	}
	return &DBs{Text: text, Dict: dict}, nil
}

func (d *DBs) get(name string) *sql.DB {
	if name == "dict" {
		return d.Dict
	}
	return d.Text
}

func (d *DBs) Meta() (map[string]string, error) {
	rows, err := d.Text.Query("SELECT k, v FROM meta")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	m := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		m[k] = v
	}
	return m, rows.Err()
}
