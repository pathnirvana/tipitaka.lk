package main

import (
	"regexp"
	"strings"
)

// Go port of shared/markup.ts parseMarkup + tokensToHtml. Must produce exactly the same HTML
// (tested with shared/markup-cases.json).

var (
	pairKinds = map[string][2]string{
		"**": {"<b>", "</b>"}, "__": {"<u>", "</u>"}, "~~": {"<s>", "</s>"},
		"##": {"<mark>", "</mark>"}, "$$": {`<span class="editorial">`, "</span>"},
	}
	tagRe    = regexp.MustCompile(`(?i)^<(/?)(hr|b)\s*/?>`)
	entityRe = regexp.MustCompile(`^&(gt|lt|amp);`)
	entities = map[string]string{"&gt;": ">", "&lt;": "<", "&amp;": "&"}
	htmlEsc  = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;")
)

// MarkupToHTML renders BJT markup as safe HTML.
func MarkupToHTML(text string, hideFnRefs bool) string {
	var b strings.Builder
	renderRange(&b, text, 0, len(text), hideFnRefs)
	return b.String()
}

func renderRange(b *strings.Builder, s string, start, end int, hideFn bool) {
	var buf strings.Builder
	flush := func() {
		if buf.Len() > 0 {
			b.WriteString(htmlEsc.Replace(buf.String()))
			buf.Reset()
		}
	}
	i := start
	for i < end {
		if i+2 <= len(s) {
			two := s[i : i+2]
			if tags, ok := pairKinds[two]; ok {
				close := strings.Index(s[i+2:], two)
				if close >= 0 && i+2+close+2 <= end {
					close += i + 2
					flush()
					b.WriteString(tags[0])
					renderRange(b, s, i+2, close, hideFn)
					b.WriteString(tags[1])
					i = close + 2
				} else {
					buf.WriteString(two)
					i += 2
				}
				continue
			}
		}
		ch := s[i]
		switch {
		case ch == '{':
			if c := strings.IndexByte(s[i+1:], '}'); c > 0 {
				close := i + 1 + c
				if close < end && !strings.Contains(s[i+1:close], "\n") {
					flush()
					if !hideFn {
						b.WriteString(`<sup class="fn">` + htmlEsc.Replace(s[i+1:close]) + `</sup>`)
					}
					i = close + 1
					continue
				}
			}
		case ch == '\n':
			flush()
			b.WriteString("<br>")
			i++
			continue
		case strings.HasPrefix(s[i:], "↴"):
			flush()
			b.WriteString("<br>")
			i += len("↴")
			continue
		case ch == '<':
			lim := min(end, i+8)
			if m := tagRe.FindStringSubmatch(s[i:lim]); m != nil {
				if strings.ToLower(m[2]) == "hr" {
					flush()
					b.WriteString("<hr>")
				}
				i += len(m[0])
				continue
			}
		case ch == '&':
			if m := entityRe.FindString(s[i:min(len(s), i+5)]); m != "" {
				buf.WriteString(entities[m])
				i += len(m)
				continue
			}
		}
		buf.WriteByte(ch)
		i++
	}
	flush()
}
