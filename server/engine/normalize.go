package engine

import (
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// Fold removes diacritics and lower cases (must equal shared/normalize.ts fold).
func Fold(s string) string {
	d := norm.NFD.String(s)
	var b strings.Builder
	b.Grow(len(d))
	for _, r := range d {
		if r >= 0x300 && r <= 0x36f {
			continue
		}
		b.WriteRune(r)
	}
	return strings.ToLower(b.String())
}

// HasDiacritics reports whether s contains letters with diacritics.
func HasDiacritics(s string) bool {
	return Fold(s) != strings.ToLower(s)
}

// Reverse reverses the runes of s.
func Reverse(s string) string {
	r := []rune(s)
	for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
		r[i], r[j] = r[j], r[i]
	}
	return string(r)
}

// NormalizeWord lower cases and composes (shared/tokenize.ts normalizeWord).
func NormalizeWord(s string) string {
	return strings.ToLower(norm.NFC.String(s))
}

// isLetter matches the tokenizer's letter class (\p{L}\p{M}).
func isLetter(r rune) bool { return unicode.IsLetter(r) || unicode.Is(unicode.M, r) }

// Levenshtein distance on runes.
func Levenshtein(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	prev := make([]int, len(rb)+1)
	cur := make([]int, len(rb)+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= len(ra); i++ {
		cur[0] = i
		for j := 1; j <= len(rb); j++ {
			cost := 1
			if ra[i-1] == rb[j-1] {
				cost = 0
			}
			cur[j] = min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost)
		}
		prev, cur = cur, prev
	}
	return prev[len(rb)]
}
