package tree_sitter_tablegen_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_tablegen "github.com/felixtensor/tree-sitter-tablegen/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_tablegen.Language())
	if language == nil {
		t.Errorf("Error loading TableGen grammar")
	}
}
