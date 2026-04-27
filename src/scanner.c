#include "tree_sitter/parser.h"
#include <string.h>
#include <wctype.h>

enum TokenType {
  CODE_CHUNK,
  LEADING_DIGIT_IDENT,
  ERROR_SENTINEL,
};

static inline bool is_ident_continue(int32_t c) {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
         (c >= '0' && c <= '9') || c == '_';
}

static inline bool is_ident_start(int32_t c) {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c == '_';
}

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

  // Leading-digit identifier: `[0-9]+[A-Za-z_][A-Za-z0-9_]*`.
  // Emitted only here because tree-sitter's built-in lexer can't outrank
  // `integer_literal` (whose precedence wins ties) without losing on hex/bin
  // tokens. We require at least one digit followed by a letter/underscore
  // before committing, so plain numeric tokens stay with `integer_literal`.
  // CODE_CHUNK is only valid inside a `[{ ... }]` block where the scanner
  // must not skip whitespace; for LEADING_DIGIT_IDENT we skip leading
  // whitespace ourselves because tree-sitter's pre-scan extras pass doesn't
  // run before external scanners.
  if (valid_symbols[LEADING_DIGIT_IDENT] && !valid_symbols[CODE_CHUNK]) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
           lexer->lookahead == '\n' || lexer->lookahead == '\r') {
      lexer->advance(lexer, true);
    }
    if (lexer->lookahead >= '0' && lexer->lookahead <= '9') {
      // Bail out for `0x...` / `0b...` so `integer_literal` keeps owning
      // hex and binary literals. We only want to take ownership when the
      // token is unambiguously a leading-digit name like `1OverrideOp`.
      bool first_zero = lexer->lookahead == '0';
      advance(lexer);
      if (first_zero && (lexer->lookahead == 'x' || lexer->lookahead == 'X' ||
                         lexer->lookahead == 'b' || lexer->lookahead == 'B')) {
        return false;
      }
      while (lexer->lookahead >= '0' && lexer->lookahead <= '9') {
        advance(lexer);
      }
      if (!is_ident_start(lexer->lookahead)) {
        return false;
      }
      while (is_ident_continue(lexer->lookahead)) {
        advance(lexer);
      }
      lexer->result_symbol = LEADING_DIGIT_IDENT;
      return true;
    }
    return false;
  }

  if (!valid_symbols[CODE_CHUNK]) {
    return false;
  }

  // Scan chunk content until `$<id>` (variable substitution) or
  // `}]` (end of code literal, matched as a combined token by the CFG).
  // A bare `$` not followed by an identifier char is part of the chunk
  // (e.g. `$._` literal text in op assembly format).
  bool consumed_any = false;
  while (lexer->lookahead != 0) {
    if (lexer->lookahead == '$') {
      // Peek without consuming: only stop if it begins a substitution.
      lexer->mark_end(lexer);
      advance(lexer);
      int32_t after = lexer->lookahead;
      if ((after >= 'A' && after <= 'Z') ||
          (after >= 'a' && after <= 'z') ||
          (after >= '0' && after <= '9') ||
          after == '_') {
        // Real substitution boundary — emit chunk so far.
        if (consumed_any) {
          lexer->result_symbol = CODE_CHUNK;
          return true;
        }
        return false;
      }
      // Bare `$` — include it and keep scanning.
      consumed_any = true;
      lexer->mark_end(lexer);
      continue;
    }
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
