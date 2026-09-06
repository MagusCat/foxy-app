package notebooks

import "testing"

func TestGenCodeShapeAndAlphabet(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 1000; i++ {
		c := genCode()
		if len(c) != 6 {
			t.Fatalf("the code must be 6 characters, got %q", c)
		}
		for _, r := range c {
			if !containsRune(codeAlphabet, r) {
				t.Fatalf("character outside the alphabet: %q in %q", r, c)
			}
		}
		seen[c] = true
	}
	// 1000 codes out of 32^6 combinations: collisions should be practically none.
	if len(seen) < 995 {
		t.Fatalf("too many collisions: %d unique out of 1000", len(seen))
	}
}

func containsRune(s string, r rune) bool {
	for _, c := range s {
		if c == r {
			return true
		}
	}
	return false
}
