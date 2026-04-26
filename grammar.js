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
      $.class_definition,
      $.def_definition,
      // more to come in later tasks
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

    // Task 5: class, def, body items
    class_definition: $ => seq(
      "class",
      $.identifier,
      optional($.template_parameters),       // declared in Task 6
      optional($.parent_class_list),
      $.body,
    ),

    def_definition: $ => seq(
      "def",
      optional($._value),                    // _value declared below; temporary stub
      optional($.parent_class_list),
      $.body,
    ),

    parent_class_list: $ => seq(
      ":",
      $.parent_class,
      repeat(seq(",", $.parent_class)),
    ),

    parent_class: $ => seq(
      $.identifier,
      optional(seq("<", optional($.argument_list), ">")),  // argument_list in Task 9
    ),

    body: $ => choice(
      ";",
      seq("{", repeat($._body_item), "}"),
    ),

    _body_item: $ => choice(
      $.field_declaration,
      $.let_assignment,
      $.defvar_statement,
      $.assert_statement,
      // foreach/if/dump added in later tasks
    ),

    field_declaration: $ => seq(
      optional("field"),
      $.type,
      $.identifier,
      optional(seq("=", $._value)),
      ";",
    ),

    let_assignment: $ => seq(
      "let",
      optional($.let_mode),
      $.identifier,
      optional($.range_list),                // range_list in Task 7
      "=",
      $._value,
      ";",
    ),

    let_mode: _ => choice("append", "prepend"),

    defvar_statement: $ => seq(
      "defvar",
      $.identifier,
      "=",
      $._value,
      ";",
    ),

    assert_statement: $ => seq(
      "assert",
      $._value,
      ",",
      $._value,
      ";",
    ),

    // Temporary stub for _value - will be expanded in Task 7
    _value: $ => choice(
      $.identifier,
      $.integer_literal,
      $.string_literal,
      $.boolean_literal,
      $.unset_value,
    ),

    template_parameters: $ => seq(
      "<",
      $.template_parameter,
      repeat(seq(",", $.template_parameter)),
      ">",
    ),

    template_parameter: $ => seq(
      $.type,
      $.identifier,
      optional(seq("=", $._value)),
    ),

    // Argument list: positional then named (per spec §4.3); used by parent_class
    // and (in Task 8) anonymous_record. Final form lands in Task 9.
    argument_list: $ => seq(
      $._value,
      repeat(seq(",", $._value)),
    ),

    // Forward declaration for rule defined in later task
    range_list: $ => seq("[", $.integer_literal, "]"),
  },
});
