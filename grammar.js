/**
 * @file TableGen grammar for tree-sitter
 * @author Buyun Xu <xubuyun@outlook.com>
 * @license Apache-2.0 WITH LLVM-exception
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "tablegen",

  extras: $ => [
    /\s+/,
    $.line_comment,
    $.block_comment,
  ],

  word: $ => $.identifier,

  rules: {
    source_file: $ => repeat($._top_level_item),

    _top_level_item: $ => choice(
      // populated incrementally by later tasks
      $._placeholder_top_item,
    ),

    _placeholder_top_item: $ => seq("__placeholder__", ";"),

    line_comment: _ => token(seq("//", /[^\n]*/)),
    block_comment: _ => token(seq("/*", /([^*]|\*[^/])*/, "*/")),
    identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,
  },
});
