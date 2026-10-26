package main

import (
	"database/sql"
	"path/filepath"

	"tipitaka.lk/server/engine"

	_ "github.com/mattn/go-sqlite3"
)

// DBs holds read-only connections to text.db and dict.db.
type DBs struct {
	Text *sql.DB
	Dict *sql.DB
}

// openRO: engine.OpenRO (strictly read-only)
func openRO(path string) (*sql.DB, error) { return engine.OpenRO(path) }

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
