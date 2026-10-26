// Package mobile is the gomobile binding of the engine for the Android and iOS apps (tipitaka.app's server/mobile):
//
//	gomobile bind -target=android -androidapi 24 -javapkg lk.tipitaka.engine ./mobile   (AAR)
//	gomobile bind -target=ios ./mobile                                                    (xcframework)
//
// The native side opens the databases once and forwards the web app's requests (JSON: a named query or an
// operation) on a background thread; see dev-docs/native-bridge.md.
package mobile

import "tipitaka.lk/server/engine"

// Engine wraps the engine with gomobile friendly types.
type Engine struct{ e *engine.Engine }

// Open opens text.db and dict.db (dictPath may be empty).
func Open(textPath, dictPath string) (*Engine, error) {
	e, err := engine.OpenFiles(textPath, dictPath)
	if err != nil {
		return nil, err
	}
	return &Engine{e}, nil
}

// Query runs {"query": name, params} or {"op": ..., params} and returns {"ok": result} or {"error": code, "message":
// text}. Safe to call from several threads.
func (m *Engine) Query(request string) string { return m.e.QueryJSON(request) }

// Version is the content hash of the open text database.
func (m *Engine) Version() string { return m.e.Meta["content_hash"] }

// Close closes the databases.
func (m *Engine) Close() { m.e.Close() }
