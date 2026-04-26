#include "tree_sitter/parser.h"
#include <string.h>
#include <wctype.h>

enum TokenType {
  CODE_CHUNK,
  ERROR_SENTINEL,
};

void *tree_sitter_tablegen_external_scanner_create(void) {
  return NULL;
}

void tree_sitter_tablegen_external_scanner_destroy(void *payload) {
  (void)payload;
}

unsigned tree_sitter_tablegen_external_scanner_serialize(
    void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_tablegen_external_scanner_deserialize(
    void *payload, const char *buffer, unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

static inline void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

bool tree_sitter_tablegen_external_scanner_scan(
    void *payload, TSLexer *lexer, const bool *valid_symbols) {
  (void)payload;

  if (!valid_symbols[CODE_CHUNK] || lexer->lookahead == 0) {
    return false;
  }

  // Scan chunk content until `$` (variable substitution) or
  // `}]` (end of code literal, matched as a combined token by the CFG).
  bool consumed_any = false;
  while (lexer->lookahead != 0) {
    if (lexer->lookahead == '$') break;
    if (lexer->lookahead == '}') {
      lexer->mark_end(lexer);
      advance(lexer);
      if (lexer->lookahead == ']') {
        // `}]` closes the block — stop chunk here.
        if (consumed_any) {
          lexer->result_symbol = CODE_CHUNK;
          return true;
        }
        return false;
      }
      // Bare `}` inside code — include it in the chunk.
      consumed_any = true;
      lexer->mark_end(lexer);
      continue;
    }
    advance(lexer);
    consumed_any = true;
    lexer->mark_end(lexer);
  }

  if (consumed_any) {
    lexer->result_symbol = CODE_CHUNK;
    return true;
  }
  return false;
}
