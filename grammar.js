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
      $.include_directive,
      $.preprocessor_directive,
      // class/def/etc populated by later tasks
    ),

    include_directive: $ => seq("include", $.string_literal),

    preprocessor_directive: $ => choice(
      seq("#define", $.macro_name),
      seq("#ifdef", $.macro_name),
      seq("#ifndef", $.macro_name),
      "#else",
      "#endif",
    ),

    macro_name: _ => /[A-Za-z_][A-Za-z0-9_]*/,

    line_comment: _ => token(seq("//", /[^\n]*/)),

    // One level of nesting via two-state regex; see spec §5.6 for upgrade path
    block_comment: _ => token(seq(
      "/*",
      repeat(choice(
        /[^*/]/,
        /\*[^/]/,
        /\/[^*]/,
        seq("/*", repeat(choice(/[^*]/, /\*[^/]/)), "*/"),
      )),
      "*/",
    )),

    identifier: _ => token(prec(-1, /[0-9]*[A-Za-z_][A-Za-z0-9_]*/)),

    integer_literal: _ => token(choice(
      /[+-]?(0x[0-9a-fA-F]+|0b[01]+|[0-9]+)/,
    )),

    string_literal: _ => token(seq(
      '"',
      repeat(choice(
        /[^"\\\n]/,
        /\\["\\tn']/,
      )),
      '"',
    )),

    boolean_literal: _ => choice("true", "false"),

    unset_value: _ => "?",

    _type: $ => choice(
      "bit",
      "int",
      "string",
      "dag",
      "code",
      seq("bits", "<", $.integer_literal, ">"),
      seq("list", "<", $._type, ">"),
      $.identifier,             // ClassID
    ),

    type: $ => $._type,         // visible alias for queries
  },
});
